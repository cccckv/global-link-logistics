# Git 上传指南

## ✅ 已完成的操作

1. ✅ 所有文件已添加到 Git 暂存区
2. ✅ 创建了初始提交（commit）
3. ✅ 提交信息包含完整的项目说明

## 📦 提交内容

**提交哈希**: `6805e4c`  
**提交信息**: "feat: 完整的国际物流系统 - 客户门户和后端API"

**文件统计**:
- 58 个文件
- 5,193 行代码
- 包含：后端、前端、配置、文档

## 🚀 下一步：推送到远程仓库

### 选项 1：推送到 GitHub

#### 步骤 1：创建 GitHub 仓库

1. 访问 https://github.com/new
2. 仓库名称：`global-link-logistics`
3. 描述：`国际物流系统 - 客户门户和管理后台`
4. 可见性：**Private**（推荐）或 Public
5. ❌ **不要**勾选 "Initialize with README"
6. 点击 "Create repository"

#### 步骤 2：获取仓库 URL

创建后会显示类似这样的 URL：
```
https://github.com/your-username/global-link-logistics.git
```

#### 步骤 3：添加远程仓库并推送

```bash
cd /tmp/www/global-link-logistics

# 添加远程仓库
git remote add origin https://github.com/your-username/global-link-logistics.git

# 推送到远程仓库
git push -u origin master
```

#### 步骤 4：验证推送成功

访问 `https://github.com/your-username/global-link-logistics` 查看代码是否已上传。

---

### 选项 2：推送到 GitLab

#### 步骤 1：创建 GitLab 项目

1. 访问 https://gitlab.com/projects/new
2. 项目名称：`global-link-logistics`
3. 可见性：**Private**
4. ❌ 不要勾选 "Initialize with README"
5. 点击 "Create project"

#### 步骤 2：添加远程仓库并推送

```bash
cd /tmp/www/global-link-logistics

# 添加远程仓库
git remote add origin https://gitlab.com/your-username/global-link-logistics.git

# 推送到远程仓库
git push -u origin master
```

---

### 选项 3：推送到 Gitee（码云）

#### 步骤 1：创建 Gitee 仓库

1. 访问 https://gitee.com/projects/new
2. 仓库名称：`global-link-logistics`
3. 是否开源：**私有**（推荐）
4. ❌ 不要勾选 "使用 Readme 文件初始化"
5. 点击 "创建"

#### 步骤 2：添加远程仓库并推送

```bash
cd /tmp/www/global-link-logistics

# 添加远程仓库
git remote add origin https://gitee.com/your-username/global-link-logistics.git

# 推送到远程仓库
git push -u origin master
```

---

### 选项 4：推送到自建 Git 服务器

如果您有自己的 Git 服务器：

```bash
cd /tmp/www/global-link-logistics

# 添加远程仓库
git remote add origin git@your-server.com:your-username/global-link-logistics.git

# 或使用 HTTPS
git remote add origin https://your-server.com/git/global-link-logistics.git

# 推送到远程仓库
git push -u origin master
```

---

## 🔐 使用 SSH 密钥（推荐）

如果您希望避免每次输入密码，可以配置 SSH 密钥：

### 生成 SSH 密钥

```bash
# 生成新的 SSH 密钥
ssh-keygen -t ed25519 -C "your-email@example.com"

# 查看公钥
cat ~/.ssh/id_ed25519.pub
```

### 添加公钥到 Git 平台

**GitHub**:
1. 访问 https://github.com/settings/keys
2. 点击 "New SSH key"
3. 粘贴公钥内容

**GitLab**:
1. 访问 https://gitlab.com/-/profile/keys
2. 粘贴公钥内容

**Gitee**:
1. 访问 https://gitee.com/profile/sshkeys
2. 粘贴公钥内容

### 使用 SSH URL 推送

```bash
cd /tmp/www/global-link-logistics

# 修改为 SSH URL（如果已添加 HTTPS 远程仓库）
git remote set-url origin git@github.com:your-username/global-link-logistics.git

# 推送
git push -u origin master
```

---

## 🔧 常用 Git 命令

```bash
# 查看远程仓库
git remote -v

# 查看提交历史
git log --oneline

# 查看当前状态
git status

# 拉取最新代码
git pull origin master

# 推送新的提交
git add .
git commit -m "update: 更新内容描述"
git push origin master
```

---

## 📝 后续协作流程

### 团队成员克隆项目

```bash
# 克隆仓库
git clone https://github.com/your-username/global-link-logistics.git

cd global-link-logistics

# 安装依赖
cd backend && npm install
cd ../frontend/customer && npm install

# 配置环境变量
cp backend/.env.example backend/.env
cp frontend/customer/.env.example frontend/customer/.env

# 启动开发环境
docker-compose up -d db cache
cd backend && npm run dev
cd ../frontend/customer && npm run dev
```

### 开发新功能

```bash
# 创建新分支
git checkout -b feature/new-feature

# 开发完成后提交
git add .
git commit -m "feat: 添加新功能"

# 推送到远程
git push origin feature/new-feature

# 在 GitHub/GitLab 上创建 Pull Request / Merge Request
```

---

## ⚠️ 重要提醒

### 敏感信息保护

以下文件已在 `.gitignore` 中排除，不会上传：

- ✅ `.env` 文件（包含密钥和密码）
- ✅ `node_modules/` 目录
- ✅ 构建产物 `dist/`
- ✅ 日志文件

**永远不要提交**:
- API 密钥（Stripe、Mapbox、Cesium）
- 数据库密码
- JWT Secret
- 加密密钥
- 私钥文件

### 已上传的安全文件

- ✅ `.env.example` - 仅包含示例值，没有真实密钥
- ✅ `README.md` - 公开文档
- ✅ 源代码 - 不包含敏感信息

---

## 🆘 常见问题

### Q1: 推送时要求输入用户名和密码

**原因**: 使用 HTTPS URL

**解决方法**:
1. 配置 Git 凭证缓存：
   ```bash
   git config --global credential.helper cache
   ```
2. 或切换到 SSH（见上文"使用 SSH 密钥"）

### Q2: 推送被拒绝（rejected）

**错误信息**: `! [rejected] master -> master (fetch first)`

**原因**: 远程仓库有本地没有的提交

**解决方法**:
```bash
git pull origin master --rebase
git push origin master
```

### Q3: 文件太大无法推送

**错误信息**: `remote: error: File ... is ... MB; this exceeds GitHub's file size limit`

**解决方法**:
1. 检查大文件：
   ```bash
   find . -type f -size +50M
   ```
2. 添加到 `.gitignore`
3. 使用 Git LFS（Large File Storage）

### Q4: 忘记配置 .gitignore，上传了 node_modules

**解决方法**:
```bash
# 移除已跟踪的 node_modules
git rm -r --cached node_modules/

# 确保 .gitignore 包含 node_modules/
echo "node_modules/" >> .gitignore

# 提交修改
git add .gitignore
git commit -m "chore: 移除 node_modules"
git push origin master
```

---

## 📊 当前仓库统计

```
提交数: 1
分支: master
文件数: 58
代码行数: 5,193
大小: ~2.5 MB
```

---

## ✅ 检查清单

推送前请确认：

- [ ] 已创建远程仓库（GitHub/GitLab/Gitee）
- [ ] 已获取仓库 URL
- [ ] `.env` 文件未被提交
- [ ] 敏感信息已从代码中移除
- [ ] 提交信息清晰描述了更改内容
- [ ] 团队成员有访问权限（如果是私有仓库）

推送后请验证：

- [ ] 访问远程仓库 URL 确认代码已上传
- [ ] README.md 正确显示
- [ ] 文件结构完整
- [ ] 文档可访问

---

**准备好后，选择上述任一平台并执行相应的推送命令！** 🚀

如有问题，请查看上述常见问题部分或联系技术支持。
