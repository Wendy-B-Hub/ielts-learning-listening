# 雅思听力词汇 PWA — 云服务器部署指南

---

## 第一步：安装 Node.js（首次部署才需要）

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v && npm -v
```

---

## 第二步：拉取代码 & 构建

```bash
cd /var/www
git clone https://你的token@github.com/Wendy-B-Hub/ielts-learning-listening.git
cd ielts-learning-listening

npm install

# 写入 COS 地址（只需配置一次）
echo "VITE_COS_BASE_URL=https://你的bucket-appid.cos.ap-guangzhou.myqcloud.com" > .env.production.local

npm run build
```

---

## 第三步：Nginx 添加 server 块

```bash
cat > /etc/nginx/sites-available/listening << 'EOF'
server {
    listen 80;
    server_name listening.xyruida.cn;

    root /var/www/ielts-learning-listening/dist;
    index index.html;

    # SPA：所有路径回退到 index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资源长缓存
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Service Worker 不缓存
    location /sw.js {
        add_header Cache-Control "no-cache";
    }
}
EOF

ln -s /etc/nginx/sites-available/listening /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

---

## 第四步：HTTPS（Certbot，推荐）

```bash
sudo certbot --nginx -d listening.xyruida.cn
```

> HTTPS 是 PWA 在手机安装到主屏幕所必须的。

---

## 后续更新词汇时（在本地 Mac 操作）

```bash
# 1. 本地增改词汇后重新导出 + 构建
npm run build:local

# 2. 下载新增词汇的音频（已有的自动跳过）
npm run download-audio

# 3. 把新 MP3 上传到 COS（SFTP 或控制台）

# 4. 推到 GitHub
git add src/data/ && git commit -m "update vocab" && git push
```

**服务器拉取更新：**

```bash
cd /var/www/ielts-learning-listening
git pull && npm install && npm run build
```
