import os
import sys
import zipfile
import xml.etree.ElementTree as ET
import glob
import json

sys.stdout.reconfigure(encoding='utf-8')

info_dir = r"d:\ccccc\projects\global-link-logistics\info"
f1 = os.path.join(info_dir, "万海入库计划表 广州 2026.8.13xlsx.xlsx.xlsx")
f2 = os.path.join(info_dir, "万海入库计划表 印尼 泰国 马来 2026.8.13.xlsx.xlsx")

def get_shared_strings(z):
    try:
        xml_content = z.read('xl/sharedStrings.xml')
        root = ET.fromstring(xml_content)
        ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
        strings = []
        for si in root.findall('.//ns:si', ns):
            text_nodes = si.findall('.//ns:t', ns)
            text = "".join([t.text or "" for t in text_nodes])
            strings.append(text)
        return strings
    except KeyError:
        return []

def get_sheets(z):
    try:
        xml_content = z.read('xl/workbook.xml')
        root = ET.fromstring(xml_content)
        ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
              'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
        sheets = []
        for sheet in root.findall('.//ns:sheet', ns):
            name = sheet.attrib.get('name')
            r_id = sheet.attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
            sheets.append((name, r_id))
        return sheets
    except Exception as e:
        return []

def inspect_file(f):
    fname = os.path.basename(f)
    print(f"\n=================== FILE: {fname} ===================")
    with zipfile.ZipFile(f, 'r') as z:
        shared_strings = get_shared_strings(z)
        sheets = get_sheets(z)
        
        try:
            rels_xml = z.read('xl/_rels/workbook.xml.rels')
            rels_root = ET.fromstring(rels_xml)
            rel_ns = {'r': 'http://schemas.openxmlformats.org/package/2006/relationships'}
            rel_map = {}
            for rel in rels_root.findall('.//r:Relationship', rel_ns):
                rel_map[rel.attrib['Id']] = rel.attrib['Target']
        except Exception:
            rel_map = {}

        for sname, r_id in sheets:
            target = rel_map.get(r_id, '')
            if target.startswith('/'):
                target = target[1:]
            elif not target.startswith('xl/'):
                target = 'xl/' + target
            
            print(f"\n--- Sheet: {sname} ---")
            try:
                sheet_xml = z.read(target)
                sheet_root = ET.fromstring(sheet_xml)
                ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
                
                for row in sheet_root.findall('.//ns:row', ns)[:6]:
                    row_idx = row.attrib.get('r')
                    cells = []
                    for c in row.findall('./ns:c', ns):
                        t = c.attrib.get('t')
                        v = c.find('./ns:v', ns)
                        val = v.text if v is not None else ""
                        if t == 's' and val:
                            val = shared_strings[int(val)] if int(val) < len(shared_strings) else val
                        elif t == 'inlineStr':
                            is_node = c.find('./ns:is/ns:t', ns)
                            if is_node is not None:
                                val = is_node.text or ""
                        col_ref = c.attrib.get('r')
                        cells.append(f"{col_ref}:{val.strip()}")
                    print(f"Row {row_idx}: " + " | ".join(cells))
            except Exception as e:
                print(f"Error: {e}")

inspect_file(f1)
inspect_file(f2)
