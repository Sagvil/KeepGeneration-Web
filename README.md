# KeepGenertion Web: 网页版Keep跑步截图生成器

## 🌐 项目简介

KeepGenertion Web 是基于[KeepSultan](https://github.com/Carzit/KeepSultan)开发的网页版工具，将原项目的核心功能迁移至浏览器环境，无需安装即可生成Keep风格跑步截图。

## 🚀 在线体验

[立即使用](https://keep.hshoe.cn)  
无需安装，打开即用

## ✨ 核心功能

### 1. 全功能网页化实现
- 完整保留原项目所有参数自定义能力
- 响应式设计，支持电脑/手机浏览器访问
- 支持预览生成效果

### 2. 增强特性
- **拖拽上传**：支持直接拖拽图片到上传区域
- **智能随机生成**：参数填写范围每次自动随机

### 3. 功能改进
- **修复生成逻辑问题**：修复步频超过三位数时生成图片的越界问题
- **地点天气温度**：在原项目基础上添加地点天气温度的生成并实现自定义功能
- **字体改进**：使用keep官方字体
- **预设地图**：添加更多预设地图，更适合SYSU的使用


## 🛠️ 使用指南

### 基本使用
1. 上传头像（建议1:1比例）
2. 上传地图（建议35:28比例）
3. 修改随机生成运动参数
4. 点击"生成截图"按钮
5. 下载结果

### 参数说明
- 日期（date）
- 地点（location）
- 天气（weather）
- 温度（temperature）
- 结束时间（end_time）
- 跑步总里程（total_km）
- 运动时间（sport_time）
- 总计时间（total_time）
- 累计爬升（cumulative_climb）
- 平均步频（average_cadence）
- 运动负荷（exercise_load）

我们建议您上传的头像图片宽高比为1:1，地图图片宽高比为35:28


## 🐳 Docker 部署

本项目已发布 Docker 镜像到 Docker Hub，可以通过以下命令快速部署：

1. **拉取镜像**

```bash
docker pull eltsen00/keepsultan:latest
```

2. **运行容器**

```bash
docker run -d \
  --name keepsultan \
  -p 5010:5010 \
  -v ./uploads:/app/static/uploads \
  -v ./output:/app/static/output \
  -e "SECRET_KEY=your_secret_key_here" \
  --restart=unless-stopped \
  eltsen00/keepsultan:latest
```

另外，本项目也提供的源代码，放置在keep-html文件夹中，可以直接在机器本地部署，需要的依赖已在/keep-html/requirements.txt中写明

## 📜 免责声明

本工具仅供个人学习与研究使用，与Keep官方无任何关联。使用者应对生成内容负责，开发者不承担由此产生的任何责任。

## ❤️ 致谢

- 原项目开发者 [Carzit](https://github.com/Carzit)
- 所有贡献者和用户
