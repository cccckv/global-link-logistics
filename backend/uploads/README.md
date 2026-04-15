# Uploads Directory

This directory contains user-uploaded files for the Global Link Logistics system.

## Directory Structure

```
uploads/
├── payment-vouchers/     # 收款凭证文件（图片/PDF）
│   ├── YYYY/            # 按年份组织
│   │   ├── MM/          # 按月份组织
│   │   │   ├── {uuid}.jpg
│   │   │   ├── {uuid}.png
│   │   │   └── {uuid}.pdf
└── README.md
```

## Payment Vouchers (收款凭证)

**路径**: `payment-vouchers/YYYY/MM/{uuid}.{ext}`

**用途**: 存储订单收款凭证（银行转账截图、收据等）

**命名规范**:
- 使用 UUID 作为文件名，避免文件名冲突
- 保留原始文件扩展名 (.jpg, .png, .pdf, etc.)
- 按年月组织目录结构，便于管理和备份

**支持的文件类型**:
- 图片: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`
- 文档: `.pdf`

**文件大小限制**: 建议 < 10MB

**访问权限**: 
- 仅后端 API 可访问
- 前端通过 `/api/uploads/payment-vouchers/:filename` 路由获取

## Security Notes

1. **Never commit actual uploaded files to Git**
2. Files in this directory should be excluded via `.gitignore` (except `.gitkeep`)
3. Implement file type validation and virus scanning before saving
4. Set proper file permissions (644 for files, 755 for directories)
5. Consider using cloud storage (S3, OSS) for production environments

## Backup Strategy

- Daily backup of the entire `uploads/` directory
- Retain backups for at least 90 days
- Store backups in a separate location/server
