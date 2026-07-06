# 素材来源与接入计划

## 当前项目内原创素材

- `src/assets/art/menu-key-art.png`
  - 用途：开始界面、选关界面主视觉背景。
  - 来源：用户生成素材，由 `src/assets/art/1.png` 复制为语义化文件名。

- `src/assets/art/ui-kit-generated.png`
  - 用途：后续切图参考，包含卡牌框、按钮、进度条等。
  - 来源：用户生成素材，由 `src/assets/art/2.png` 复制为语义化文件名。

- `src/assets/art/plant-sunflower-portrait.png`
  - 用途：后续卡牌/详情头像参考。
  - 来源：用户生成素材，由 `src/assets/art/3.png` 复制为语义化文件名。

- `src/assets/art/zombie-client-portrait.png`
  - 用途：后续敌人卡牌/图鉴/波次提示头像参考。
  - 来源：用户生成素材，由 `src/assets/art/4.png` 复制为语义化文件名。

- `src/assets/art/tile-kit-generated.png`
  - 用途：后续切出草地、办公室地砖、入口、文件夹等场景贴图。
  - 来源：用户生成素材，由 `src/assets/art/5.png` 复制为语义化文件名。

- `src/assets/tiles/grass-board.png`
- `src/assets/tiles/office-board.png`
- `src/assets/tiles/spawn-gate.png`
  - 用途：Three.js 棋盘、工位基地、房区入口运行时贴图。
  - 来源：从 `src/assets/art/tile-kit-generated.png` 裁剪。

## 当前已接入外部素材

- Kenney UI Pack 2.0: https://kenney.nl/assets/ui-pack
  - 本地目录：`src/assets/vendor/kenney-ui-pack/`
  - 已接入文件：按钮 PNG、星标 PNG、Kenney Future 字体、Kenney Future Narrow 字体、点击/切换音效。
  - 许可：Creative Commons CC0；可用于个人、教育、商业项目，署名非必需。
  - 下载包 SHA256：`A8A14A234911EB648C062622915C93E79E94E97CB7F9F375A70F6617F1174318`

## 推荐外部素材方向

如果需要更成熟的商业化美术观感，建议优先使用明确可商用的素材库：

- Kenney.nl UI Pack: https://kenney.nl/assets/ui-pack
  - 用途：低多边形 UI、游戏图标、粒子/特效贴图、按钮音效。
  - 许可：Creative Commons CC0；Kenney 支持页说明游戏素材可用于商业项目，署名非必需。
  - 优先级：最高，适合先下载接入。

- OpenGameArt.org: https://opengameart.org/
  - 用途：卡牌框、按钮音效、UI 面板、战斗特效。
  - 注意：逐条确认 license，优先 CC0 或 CC-BY。

- itch.io Free Game Assets
  - 用途：完整 UI pack、塔防/卡牌 UI、低多边形角色包。
  - 注意：每个 asset pack 许可证不同，需要记录作者和链接。

- Poly Haven / AmbientCG
  - 用途：草地、木纹、纸张、金属等 PBR 纹理。
  - 许可：多为 CC0，适合 Three.js 材质升级。

## 下一步建议

1. 下载一套 CC0 UI pack，替换当前 CSS 里的程序化面板。
2. 下载或生成 4 张角色立绘：向日葵社畜、PPT 射手、996 坚果墙、老板僵尸。
3. 下载 8-12 张小型特效贴图：金币/摸鱼值、命中火花、烟尘、爆炸、冻结、眩晕。
4. 给所有外部素材建立 `src/assets/vendor/<source>/` 目录，并在本文件补充原始链接和许可证。

## 仍需生成的强定制素材

### 主视觉背景

建议尺寸：`1920x1080`，保存为 `src/assets/art/menu-key-art.png`。

```text
低多边形 3D 休闲塔防手游主视觉，主题是“植物大战职场僵尸：牛马版”，不要照搬任何现有 IP。画面中间是绿色棋盘草地战场，右侧是现代办公室工位基地和电脑桌，左侧是居民楼/需求入口。几个可爱的打工人植物单位在防守：向日葵社畜、PPT射手、疲惫坚果墙。对面有穿西装的甲方僵尸、红色 KPI 僵尸、金色老板僵尸逼近。成熟商业手游 key art，low poly 3D render，暖色夕阳，清晰轮廓，干净构图，左上或中上保留标题空间。不要任何文字，不要 logo，不要水印，不要 UI。
```

### 角色卡牌立绘

建议尺寸：`1024x1024`，纯色背景或透明背景，单角色居中。

```text
低多边形 3D 休闲塔防游戏角色立绘，一个【角色名】，职场荒诞喜剧风格，完整身体，正面 3/4 视角，清晰轮廓，适合卡牌图标和游戏商店展示。成熟手游资产质感，颜色鲜明但不幼稚。纯色背景，无遮挡，不要文字，不要 logo，不要水印。
```

已有：向日葵社畜、甲方僵尸。

仍建议补齐：PPT射手、996坚果墙、行政审批员、KPI僵尸、老板僵尸、工贼老板。
