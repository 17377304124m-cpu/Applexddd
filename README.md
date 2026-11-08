# 明军的主页（Applexddd）

- **项目版本**：v1.0
- **项目目标**：一个个人主页 + 随身工具的单页网站，本地双击即可使用，并支持 iPhone Safari"添加到主屏幕"像 App 一样快速打开。

## 当前进度

已完成 v1.0 全部功能，可直接使用。

## 已完成内容

- 个人主页：头像、名字、签名、简介（点右上角铅笔可编辑，保存在本地）；常用链接的添加与删除
- 工具页：待办清单、便签、番茄钟（25/5/15 分钟三档，带进度环与完成计数）
- iOS 主屏幕支持：`apple-touch-icon`、`apple-mobile-web-app-capable`、`manifest.json` 全套配置
- 数据全部存于浏览器 localStorage，离线可用，无需服务器
- 图标与头像由 `gen-icons.ps1` 生成（改字/配色后可重新运行）

## 使用方法

- **电脑本地**：双击 `index.html` 即可。
- **iPhone 添加到主屏幕**（需要手机能访问到页面）：
  1. 在本目录起一个局域网服务，例如 `python -m http.server 8000`
  2. 手机连同一 Wi-Fi，Safari 打开 `http://<电脑IP>:8000`
  3. 点分享按钮 →"添加到主屏幕"→ 桌面出现"明军"图标
- 也可以把本目录部署到任意静态托管（GitHub Pages 等），手机访问后同样添加到主屏幕。

## 待办事项

- 按需替换个人主页默认链接与简介文案
- 如需真实照片头像，替换 `avatar.png` 即可

## 下次衔接信息

- 入口文件 `index.html`，样式 `styles.css`，逻辑 `app.js`，localStorage 键：`profile` / `links` / `todos` / `notes` / `pomoDone`
- 重新生成图标：运行 `powershell -ExecutionPolicy Bypass -File gen-icons.ps1`
