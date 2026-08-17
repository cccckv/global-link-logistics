import os
import sys
import zipfile
import xml.etree.ElementTree as ET
import glob

sys.stdout.reconfigure(encoding='utf-8')

info_dir = r"d:\ccccc\projects\global-link-logistics\info"

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

def inspect_pricing(fpath):
    fname = os.path.basename(fpath)
    print(f"\n=======================================================")
    print(f"📊 分析文件: {fname}")
    print(f"=======================================================")
    with zipfile.ZipFile(fpath, 'r') as z:
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
            if sname == 'WpsReserved_CellImgList': continue
            target = rel_map.get(r_id, '')
            if target.startswith('/'): target = target[1:]
            elif not target.startswith('xl/'): target = 'xl/' + target
            
            print(f"\n📑 工作表: [{sname}]")
            try:
                sheet_xml = z.read(target)
                sheet_root = ET.fromstring(sheet_xml)
                ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
                
                rows = sheet_root.findall('.//ns:row', ns)
                # print headers
                header_row = rows[1] if len(rows) > 1 and sname != '清关' and sname != '其他国家入库数据' else rows[0]
                if sname in ['广州', '龙岩海运到货数据', '空运']:
                    header_row = rows[1]
                
                headers = {}
                for c in header_row.findall('./ns:c', ns):
                    col = "".join([ch for ch in c.attrib.get('r', '') if ch.isalpha()])
                    t = c.attrib.get('t')
                    v = c.find('./ns:v', ns)
                    val = v.text if v is not None else ""
                    if t == 's' and val:
                        val = shared_strings[int(val)] if int(val) < len(shared_strings) else val
                    elif t == 'inlineStr':
                        is_node = c.find('./ns:is/ns:t', ns)
                        if is_node is not None:
                            val = is_node.text or ""
                    headers[col] = val.strip()
                
                print("  表头列:", {k: v for k, v in headers.items() if v})
                
                # Sample rows focused on pricing columns
                print("\n  🔍 样本数据前 5 条计费相关列分析:")
                for r in rows[2:7] if header_row == rows[1] else rows[1:6]:
                    row_data = {}
                    for c in r.findall('./ns:c', ns):
                        col = "".join([ch for ch in c.attrib.get('r', '') if ch.isalpha()])
                        t = c.attrib.get('t')
                        v = c.find('./ns:v', ns)
                        f = c.find('./ns:f', ns)
                        formula = f.text if f is not None else None
                        val = v.text if v is not None else ""
                        if t == 's' and val:
                            val = shared_strings[int(val)] if int(val) < len(shared_strings) else val
                        elif t == 'inlineStr':
                            is_node = c.find('./ns:is/ns:t', ns)
                            if is_node is not None:
                                val = is_node.text or ""
                        hname = headers.get(col, col)
                        if formula:
                            row_data[hname] = f"{val} [公式: ={formula}]"
                        else:
                            row_data[hname] = val
                    
                    # Filter for interesting pricing columns
                    pricing_info = {k: v for k, v in row_data.items() if any(w in k for w in ['客户', '品名', '体积', '重量', '应收', '应付', '单价', '成本', '车费', '订舱', '港杂', '拖车', '报价', '利润', 'THC', 'thc', '数量', '长', '宽', '高']) and v}
                    print("   -", pricing_info)
            except Exception as e:
                print(f"  Error: {e}")

for f in sorted(glob.glob(os.path.join(info_dir, "*.xlsx*"))):
    inspect_pricing(f)
