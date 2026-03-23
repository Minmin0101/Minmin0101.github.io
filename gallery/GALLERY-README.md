# 相册自动化速查手册

这个文件是给你以后“快速照着做”的短版说明。

如果你要新增相册、上传图片、更新相册页，主要只看这 3 个文件：

- `D:\blog\Minmin0101.github.io\build-gallery.bat`
- `D:\blog\Minmin0101.github.io\gallery\gallery-albums.txt`
- `D:\blog\Minmin0101.github.io\gallery\index.html`

其中：

- `build-gallery.bat`
  你双击运行的脚本
- `gallery-albums.txt`
  你真正要填写的相册配置文件
- `gallery/index.html`
  脚本自动生成后的相册页结果

---

## 一、最短操作流程

以后每次新增相册，直接按这 5 步：

1. 在这里新建一个相册文件夹  
   `D:\blog\Minmin0101.github.io\img\gallery\你的相册目录`

2. 把照片复制进去

3. 打开  
   `D:\blog\Minmin0101.github.io\gallery\gallery-albums.txt`

4. 在文件末尾新增一个 `[album]` 配置块

5. 双击  
   `D:\blog\Minmin0101.github.io\build-gallery.bat`

跑完后，相册页会自动更新：

- 相册卡片
- 相册总数
- 照片总数
- 相册页左侧菜单数量
- 其它页面左侧菜单里的“相册”数量

---

## 二、图片放哪里

统一放这里最省心：

`D:\blog\Minmin0101.github.io\img\gallery`

例如你新建一个“春天短途”相册，可以这样放：

```text
D:\blog\Minmin0101.github.io\img\gallery\2026-spring-trip\01.jpg
D:\blog\Minmin0101.github.io\img\gallery\2026-spring-trip\02.jpg
D:\blog\Minmin0101.github.io\img\gallery\2026-spring-trip\03.jpg
```

---

## 三、配置文件怎么写

文件：

`D:\blog\Minmin0101.github.io\gallery\gallery-albums.txt`

### 1. 开头这几项是整页共用设置

```text
page_subtitle=这里放生活切片、界面草稿和想留下来的旅途画面。
overview_label=Album Archive
overview_title=把生活碎片收进相册里，想看的时候就翻出来。
overview_copy=每一本相册都可以继续往里加照片，点开后支持上一张、下一张和右上角关闭。
upload_root=D:\blog\Minmin0101.github.io\img\gallery
```

这些对应：

- `page_subtitle=`
  相册页标题下面那句副标题
- `overview_label=`
  相册总览左上角小字
- `overview_title=`
  相册总览大标题
- `overview_copy=`
  相册页那段说明文字
- `upload_root=`
  相册图片总目录

### 2. 每个 `[album]` 代表一本相册

直接复制下面这段改：

```text
[album]
title=春天短途
subtitle=把风、树影和午后天光收进一页里。
folder=D:\blog\Minmin0101.github.io\img\gallery\2026-spring-trip
cover=01.jpg
photo=湖边长椅|01.jpg|坐了十分钟，风很轻。
photo=树影落地|02.jpg|阳光把叶子的边缘照得很清楚。
photo=回程天色|03.jpg|返程路上拍到的最后一张。
```

字段意思：

- `title=`
  相册名字
- `subtitle=`
  相册简介
- `folder=`
  这本相册的图片文件夹
- `cover=`
  封面图文件名
- `photo=`
  单张照片的信息

`photo=` 的格式固定是：

```text
照片标题|文件名或路径|照片说明
```

---

## 四、懒人模式

如果你不想一张张写 `photo=`，也可以只写：

```text
[album]
title=春天短途
subtitle=把风、树影和午后天光收进一页里。
folder=D:\blog\Minmin0101.github.io\img\gallery\2026-spring-trip
cover=01.jpg
```

然后把图片全放进这个目录里。  
脚本会自动扫描图片并生成相册。

注意：

- 自动扫描时，图片标题会默认取文件名
- 如果你想要更好看的照片标题和说明，就手写 `photo=`

---

## 五、如何运行

### 方法 A：直接双击

双击：

`D:\blog\Minmin0101.github.io\build-gallery.bat`

### 方法 B：命令行运行

```powershell
cd D:\blog\Minmin0101.github.io
.\build-gallery.bat
```

正常成功时，你会看到类似：

```text
Built gallery with 3 album(s) and 9 photo(s).
Gallery build completed.
```

---

## 六、改完后去哪里看

本地看这里：

`http://127.0.0.1:4000/gallery/`

线上看这里：

`https://minmin0101.github.io/gallery/`

如果你改了配置但页面没变，先检查：

1. `build-gallery.bat` 有没有成功跑完
2. 图片是不是确实放进了你写的 `folder=`
3. `cover=` 文件名是不是写对了
4. 浏览器是不是需要 `Ctrl + F5` 强刷

---

## 七、以后最常用的一句

以后你只要记住：

先把图片放进  
`D:\blog\Minmin0101.github.io\img\gallery\你的相册目录`

再去改  
`D:\blog\Minmin0101.github.io\gallery\gallery-albums.txt`

最后双击  
`D:\blog\Minmin0101.github.io\build-gallery.bat`

就够了。
