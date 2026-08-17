import os
import sys
import zipfile
import xml.etree.ElementTree as ET

sys.stdout.reconfigure(encoding='utf-8')

fpath = r"d:\ccccc\projects\global-link-logistics\info\整柜信息进度表2026.8.13(1).xlsx"

with zipfile.ZipFile(fpath, 'r') as z:
    sheet_xml = z.read('xl/worksheets/sheet1.xml')
    sheet_root = ET.fromstring(sheet_xml)
    ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    
    for r in sheet_root.findall('.//ns:row', ns)[1:15]:
        row_idx = r.attrib.get('r')
        formulas = []
        for c in r.findall('./ns:c', ns):
            f = c.find('./ns:f', ns)
            v = c.find('./ns:v', ns)
            if f is not None:
                formulas.append(f"{c.attrib.get('r')}: ={f.text} (val: {v.text if v is not None else ''})")
        if formulas:
            print(f"Row {row_idx} formulas: " + " | ".join(formulas))
