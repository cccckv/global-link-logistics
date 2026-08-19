import path from 'path';
import fs from 'fs/promises';
import { randomUUID } from 'crypto';
import AdmZip from 'adm-zip';
import ExcelJS from 'exceljs';
import { AttachmentType } from '@prisma/client';

export interface ExtractedImageItem {
  row: number; // 1-indexed row number in worksheet
  col: number; // 1-indexed column number in worksheet
  fileUrl: string;
  fileName: string;
  fileSize: number;
  attachmentType: AttachmentType;
}

export class ImageExtractorService {
  /**
   * 从上传的 Excel 文件 Buffer 中提取所有单元格图片（兼容 WPS DISPIMG 和 Office Drawing 嵌入图）
   */
  async extractImagesFromWorkbook(
    fileBuffer: Buffer,
    worksheetName?: string
  ): Promise<Map<string, ExtractedImageItem[]>> {
    // 返回映射： key = `${row}_${col}` -> ExtractedImageItem[]
    const resultMap = new Map<string, ExtractedImageItem[]>();

    try {
      // 1. 先用 ExcelJS 解析标准 Drawing 图片
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(fileBuffer as any);

      const targetSheet = worksheetName
        ? workbook.getWorksheet(worksheetName) || workbook.worksheets[0]
        : workbook.worksheets[0];

      if (targetSheet) {
        const sheetImages = targetSheet.getImages();
        for (const img of sheetImages) {
          const imageObj = workbook.getImage(Number(img.imageId));
          if (imageObj && imageObj.buffer) {
            // img.range.tl.row is 0-indexed (top-left)
            const row = Math.floor(img.range.tl.nativeRow || img.range.tl.row) + 1;
            const col = Math.floor(img.range.tl.nativeCol || img.range.tl.col) + 1;

            const saved = await this.saveImageBuffer(
              Buffer.from(imageObj.buffer),
              imageObj.extension || 'png',
              `excel_img_${row}_${col}`
            );

            const key = `${row}_${col}`;
            const list = resultMap.get(key) || [];
            list.push({
              row,
              col,
              fileUrl: saved.fileUrl,
              fileName: saved.fileName,
              fileSize: saved.fileSize,
              attachmentType: AttachmentType.OTHER,
            });
            resultMap.set(key, list);
          }
        }
      }
    } catch (err) {
      console.warn('ExcelJS 标准图片提取警告:', err);
    }

    try {
      // 2. 用 AdmZip 解析 WPS 特有的 cellimages.xml 及 xl/media
      const zip = new AdmZip(fileBuffer);
      const zipEntries = zip.getEntries();

      // 提取 media 字典: rId / name -> Buffer
      const mediaMap = new Map<string, { buffer: Buffer; ext: string; name: string }>();
      for (const entry of zipEntries) {
        if (entry.entryName.startsWith('xl/media/')) {
          const basename = path.basename(entry.entryName);
          const ext = path.extname(basename).replace('.', '').toLowerCase() || 'png';
          mediaMap.set(basename, {
            buffer: entry.getData(),
            ext,
            name: basename,
          });
        }
      }

      // 寻找 cellimages.xml.rels
      const cellimagesRelsEntry = zip.getEntry('xl/_rels/cellimages.xml.rels');
      const rIdToMedia = new Map<string, string>();
      if (cellimagesRelsEntry) {
        const xml = cellimagesRelsEntry.getData().toString('utf8');
        const relRegex = /<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g;
        let match;
        while ((match = relRegex.exec(xml)) !== null) {
          const rId = match[1];
          const target = path.basename(match[2]);
          rIdToMedia.set(rId, target);
        }
      }

      // 寻找 cellimages.xml
      const cellimagesEntry = zip.getEntry('xl/cellimages.xml');
      if (cellimagesEntry) {
        const xml = cellimagesEntry.getData().toString('utf8');
        // 匹配 <etc:cellImage ... name="ID_xxxx"> ... <a:blip r:embed="rIdX"/>
        const cellImageRegex = /<etc:cellImage[^>]*name="([^"]+)"[\s\S]*?<a:blip[^>]*r:embed="([^"]+)"/g;
        const dispIdToMedia = new Map<string, string>();
        let m;
        while ((m = cellImageRegex.exec(xml)) !== null) {
          const dispId = m[1];
          const rId = m[2];
          const mediaFile = rIdToMedia.get(rId);
          if (mediaFile) {
            dispIdToMedia.set(dispId, mediaFile);
          }
        }

        // 也可以通过遍历 sheet xml 或者在后续解析 cell formula 时直接通过 dispIdToMedia 获取图片
        (this as any)._dispIdToMedia = dispIdToMedia;
        (this as any)._mediaMap = mediaMap;
      }
    } catch (err) {
      console.warn('WPS 内嵌图解析警告:', err);
    }

    return resultMap;
  }

  /**
   * 保存二进制图片到系统的静态资源目录 uploads/v2/YYYY/MM/
   */
  async saveImageBuffer(
    buffer: Buffer,
    extension: string,
    prefixName: string = 'import_img'
  ): Promise<{ fileUrl: string; fileName: string; fileSize: number }> {
    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const ext = extension.startsWith('.') ? extension : `.${extension}`;

    const uploadDir = path.join(process.cwd(), 'uploads', 'v2', year, month);
    await fs.mkdir(uploadDir, { recursive: true });

    const safeFilename = `${Date.now()}_${randomUUID().slice(0, 8)}_${prefixName}${ext}`;
    const filePath = path.join(uploadDir, safeFilename);

    await fs.writeFile(filePath, buffer);

    const fileUrl = `/api/v2/uploads/${year}/${month}/${safeFilename}`;
    return {
      fileUrl,
      fileName: safeFilename,
      fileSize: buffer.length,
    };
  }
}
