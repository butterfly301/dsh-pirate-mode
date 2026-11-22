# dsh-pirate-mode

给 DeepSeek Harness 加上一套海盗模式：把你当成海盗船长，把 Agent 变成你的大副，还在窗口后面铺开一片真会航行的海。

## 装完之后会变成什么样

你成了船长，Agent 成了你的大副。它会在对话里叫你“船长”，说话更热血，偶尔拿航海和寻宝打比方。这些比喻只留在聊天里，写进交付文档的内容、代码、路径和命令都保持清晰准确。派子代理干活时，它们还会按分工自动挂上船员头衔：做实现的是“船匠”，搜代码的是“瞭望手”，做查证的是“海图师”，写文档的是“文书官”，其余都是“水手”。

整个窗口后面会多出一片白天的海。主 Agent 是一艘一直往前航行的大船，干活时扬满帆，待命时收起一部分帆；每派出一个子代理，海面上就会多出一艘小艇跟着伴航。海浪随 token 吞吐起伏，右下角还会记下今天和当前航程一共航行了多少海里。

图标、部分界面文字和等待提示也会一起换掉。侧栏和首页换成海盗鲸鱼与海盗字标，“新会话”变成“新航程”，首页标题变成“扬帆，启航”。Agent 正在思考或执行任务时，状态栏每隔 10 秒换一句航海段子，比如“正在猎杀莫比·迪克”“正在说服船员不要哗变”“正在把偷懒的水手赶去刷甲板”。

插件覆盖 DeepSeek Harness 全部 8 种内置语言，包括中文、英语、日语、西班牙语、法语、德语、俄语和葡萄牙语。首次启用时会自动按你当前的界面语言切换到对应的海盗语种，不会把海外用户强行切到中文，也不会改动你原本的自定义指令、音乐或其他插件设置。

## 环境要求

- Node.js `>=24.9.0`
- DeepSeek Harness `>=0.2.2-rc.5 <0.3.0`

## 安装

打开终端，把插件装进桌面 profile：

```bash
dsh plugin --profile desktop add dsh-pirate-mode
```

随后在 `~/.dsh/profiles/desktop/package.json` 的 `dsh.profile.bundles` 列表里加上 `"dsh-pirate-mode"`，重启 DeepSeek Harness 即可。也可以直接在 DeepSeek Harness 的插件管理器中搜索 `dsh-pirate-mode` 安装并启用。

安装这一个主包会自动带齐底层的 5 个组件，不用手动逐个安装：

- `dsh-brand-pack-loader`
- `dsh-locale-pack-loader`：为全部 8 种内置语言注册对应的海盗语言包。
- `dsh-rotate-status-text`
- `dsh-ocean-background`
- `dsh-prompt-loader`

如果新版本刚发布到 npm，命令行直装遇到 pnpm 的 `minimumReleaseAge` 冷却拦截，可以在 `~/.dsh/profiles/desktop/pnpm-workspace.yaml` 的 `minimumReleaseAgeExclude` 下把 `dsh-pirate-mode` 加入白名单，或者改用 DeepSeek Harness 内置插件管理器安装。

## 怎么调、怎么改

装好后打开设置的「海盗模式」页面就能随时调整：

- 想暂时恢复正常界面，关掉总开关就行；品牌图、海盗文案、状态短句和大副人格提示词会一起停用，如果当时正在用海盗语言，也会自动切回对应的原版中文或英文。
- 侧栏图标、首页图标和字标可以分别选海盗版或原版。
- 界面文案、状态栏短句、轮换间隔以及大副人格提示词都集中在「语种内容」卡片里，顶部按语种切换，默认只展示当前正在用的这一种语言，保存后立即生效，升级插件也不会覆盖你的修改。
- 海洋背景由窗口右下角的海景按钮单独控制，可以调透明度、画质、镜头远近与角度，也可以暂停或关闭海面。

如果想给其他语言新增一套默认海盗包，往包里 `content/` 目录下放对应语言 ID 的文件就行，不用改代码：

```text
content/
├── messages/<langId>.json   # 界面按钮与标题文案
├── phrases/<langId>.txt     # 等待时轮换的短句，每行一句
└── prompts/<langId>.txt     # 大副人格提示词正文
```

## 卸载

执行下面的命令卸载，再从 `~/.dsh/profiles/desktop/package.json` 的 `dsh.profile.bundles` 中删掉 `"dsh-pirate-mode"`：

```bash
dsh plugin --profile desktop remove dsh-pirate-mode
```

## 许可

MIT
