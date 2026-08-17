import os
import sys
import zipfile
import xml.etree.ElementTree as ET
import glob
import json

sys.stdout.reconfigure(encoding='utf-8')

info_dir = r"d:\ccccc\projects\global-link-logistics\info"
excel_files = glob.glob(os.path.join(info_dir, "*.xlsx*"))

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

def inspect_all():
    summary = {}
    for f in sorted(excel_files):
        fname = os.path.basename(f)
        summary[fname] = {}
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
                
                try:
                    sheet_xml = z.read(target)
                    sheet_root = ET.fromstring(sheet_xml)
                    ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
                    
                    rows_list = []
                    for row in sheet_root.findall('.//ns:row', ns)[:5]:
                        row_cells = {}
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
                            row_cells[col_ref] = val.strip()
                        rows_list.append(row_cells)
                    summary[fname][sname] = rows_list
                except Exception as e:
                    summary[fname][sname] = str(e)
    
    print(json.dumps(summary, ensure_ascii=False, indent=2))

inspect_all()
