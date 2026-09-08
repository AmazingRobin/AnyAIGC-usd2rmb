#!/usr/bin/env python3
"""生成插件图标。

图标是一个圆角方块，背景用与「已换算」价格一致的绿色 (#009035)，
上面居中一个白色 ¥ 字符。在 128px 下渲染再降采样到各尺寸，
比直接在 16px 画布上画字要清晰得多。

用法:
    python scripts/make_icons.py
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ICON_DIR = ROOT / "icons"
SIZES = (16, 32, 48, 128)

BRAND_GREEN = (0, 144, 53, 255)
WHITE = (255, 255, 255, 255)

# 以 8x 超采样绘制，再降采样，得到平滑的圆角与字形边缘。
SUPERSAMPLE = 8
BASE = 128
CANVAS = BASE * SUPERSAMPLE

FONT_CANDIDATES = (
    "C:/Windows/Fonts/arialbd.ttf",
    "C:/Windows/Fonts/segoeuib.ttf",
    "C:/Windows/Fonts/msyhbd.ttc",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
)


def load_font(size: int) -> ImageFont.FreeTypeFont:
    """载入第一个可用的粗体字体。"""
    for path in FONT_CANDIDATES:
        if Path(path).exists():
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                continue
    raise SystemExit(
        "找不到可用的粗体字体。请在 FONT_CANDIDATES 中加入本机的字体路径。"
    )


def render_master() -> Image.Image:
    image = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    # 圆角比例参考主流扩展图标，约为边长的 22%。
    radius = int(CANVAS * 0.22)
    draw.rounded_rectangle((0, 0, CANVAS - 1, CANVAS - 1), radius=radius, fill=BRAND_GREEN)

    font = load_font(int(CANVAS * 0.70))
    # 用 anchor="mm" 加字形实际边界框做居中：¥ 的字形盒通常不对称，
    # 只按 anchor 居中会略微偏上。
    left, top, right, bottom = draw.textbbox((0, 0), "¥", font=font)
    cx = CANVAS / 2 - (left + right) / 2
    cy = CANVAS / 2 - (top + bottom) / 2
    draw.text((cx, cy), "¥", font=font, fill=WHITE)

    return image


def main() -> None:
    ICON_DIR.mkdir(parents=True, exist_ok=True)
    master = render_master()

    for size in SIZES:
        icon = master.resize((size, size), Image.LANCZOS)
        out = ICON_DIR / f"icon-{size}.png"
        icon.save(out, "PNG", optimize=True)
        print(f"  {out.relative_to(ROOT)}  ({size}x{size})")

    # Chrome 应用商店的详情页需要 440x280 的小型宣传图块。
    tile = Image.new("RGBA", (440, 280), (255, 255, 255, 255))
    logo = master.resize((176, 176), Image.LANCZOS)
    tile.paste(logo, ((440 - 176) // 2, (280 - 176) // 2), logo)
    tile_path = ICON_DIR / "store-tile-440x280.png"
    tile.convert("RGB").save(tile_path, "PNG", optimize=True)
    print(f"  {tile_path.relative_to(ROOT)}  (440x280, 商店宣传图块)")


if __name__ == "__main__":
    main()
