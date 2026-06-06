from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "docs" / "note-assets"
ASSETS.mkdir(parents=True, exist_ok=True)

FONT_REGULAR = Path("C:/Windows/Fonts/YuGothR.ttc")
FONT_MEDIUM = Path("C:/Windows/Fonts/YuGothM.ttc")
FONT_BOLD = Path("C:/Windows/Fonts/YuGothB.ttc")

W = 1200
H = 675
INK = "#172033"
MUTED = "#64748b"
BG = "#f8fafc"
LINE = "#cbd5e1"
BLUE = "#2563eb"
BLUE_DARK = "#17406d"
GREEN = "#0f766e"
RED = "#dc2626"
PANEL = "#ffffff"
SOFT_BLUE = "#eef6ff"


def font(size, weight="regular"):
    path = {
        "regular": FONT_REGULAR,
        "medium": FONT_MEDIUM,
        "bold": FONT_BOLD,
    }[weight]
    return ImageFont.truetype(str(path), size)


F = {
    "title": font(46, "bold"),
    "subtitle": font(25, "medium"),
    "body": font(24, "regular"),
    "body_bold": font(24, "bold"),
    "small": font(18, "regular"),
    "small_bold": font(18, "bold"),
    "tiny": font(15, "regular"),
    "mono": font(23, "medium"),
    "button": font(24, "bold"),
}


def text_size(draw, text, fnt):
    box = draw.textbbox((0, 0), text, font=fnt)
    return box[2] - box[0], box[3] - box[1]


def rounded(draw, box, fill, outline=None, width=1, radius=18):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def centered(draw, box, text, fnt, fill=INK):
    tw, th = text_size(draw, text, fnt)
    x1, y1, x2, y2 = box
    draw.text((x1 + (x2 - x1 - tw) / 2, y1 + (y2 - y1 - th) / 2 - 2), text, font=fnt, fill=fill)


def multiline(draw, x, y, lines, fnt, fill=INK, gap=8):
    for line in lines:
        draw.text((x, y), line, font=fnt, fill=fill)
        y += text_size(draw, line, fnt)[1] + gap
    return y


def badge(draw, x, y, text, fill=BLUE):
    tw, th = text_size(draw, text, F["small_bold"])
    box = (x, y, x + tw + 34, y + th + 22)
    rounded(draw, box, fill=fill, radius=28)
    draw.text((x + 17, y + 10), text, font=F["small_bold"], fill="#ffffff")
    return box


def arrow(draw, x1, y, x2, color=BLUE):
    draw.line((x1, y, x2, y), fill=color, width=8)
    draw.polygon([(x2, y), (x2 - 22, y - 16), (x2 - 22, y + 16)], fill=color)


def callout(draw, box, number, title, text):
    rounded(draw, box, "#ffffff", LINE, 2, 20)
    x1, y1, x2, y2 = box
    draw.ellipse((x1 + 22, y1 + 24, x1 + 72, y1 + 74), fill=BLUE)
    centered(draw, (x1 + 22, y1 + 24, x1 + 72, y1 + 74), str(number), F["small_bold"], "#ffffff")
    draw.text((x1 + 92, y1 + 22), title, font=F["body_bold"], fill=INK)
    draw.text((x1 + 92, y1 + 62), text, font=F["small"], fill=MUTED)


def base(title, subtitle):
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)
    draw.rectangle((0, 0, W, 10), fill=BLUE)
    draw.text((62, 48), title, font=F["title"], fill="#0f172a")
    draw.text((64, 110), subtitle, font=F["subtitle"], fill=MUTED)
    return img, draw


def draw_time_adjust():
    img, draw = base(
        "タイムスタンプヘルパー v0.1.3",
        "ジャンプは残したまま、記録後の時刻を微調整できるようにしました",
    )
    badge(draw, 64, 162, "新機能")

    panel = (104, 220, 1096, 414)
    rounded(draw, panel, PANEL, LINE, 2, 22)
    draw.text((144, 246), "記録したタイムスタンプ", font=F["body_bold"], fill=INK)

    row = (144, 304, 1056, 374)
    rounded(draw, row, "#f1f5f9", "#d8dee9", 2, 14)

    time_box = (172, 318, 296, 360)
    minus_box = (314, 318, 362, 360)
    plus_box = (374, 318, 422, 360)
    label_box = (444, 318, 786, 360)
    delete_box = (998, 318, 1038, 360)

    rounded(draw, time_box, "#ffffff", LINE, 2, 10)
    centered(draw, time_box, "12:34", F["mono"], BLUE_DARK)
    rounded(draw, minus_box, SOFT_BLUE, "#b6c7d8", 2, 10)
    centered(draw, minus_box, "-", F["button"], BLUE_DARK)
    rounded(draw, plus_box, SOFT_BLUE, "#b6c7d8", 2, 10)
    centered(draw, plus_box, "+", F["button"], BLUE_DARK)
    rounded(draw, label_box, "#ffffff", LINE, 2, 10)
    draw.text((464, 326), "ゴロン", font=F["body_bold"], fill=INK)
    rounded(draw, delete_box, "#ffffff", LINE, 2, 10)
    centered(draw, delete_box, "x", F["small_bold"], RED)

    callout(draw, (104, 454, 426, 596), 1, "時刻クリック", "その場面へジャンプ")
    callout(draw, (440, 454, 762, 596), 2, "- / +", "通常クリックで1秒調整")
    callout(draw, (776, 454, 1096, 596), 3, "Shift + クリック", "5秒ずつまとめて調整")
    img.save(ASSETS / "v013-time-adjust.png")


def draw_update_flow():
    img, draw = base(
        "ZIP版の更新方法",
        "前回読み込んだフォルダの中身を、新しい v0.1.3 の中身で上書きします",
    )

    cards = [
        ("1", ["新しいZIPを", "展開"], ["archive-timestamp-helper", "beta-0.1.3.zip"]),
        ("2", ["中身を全部", "コピー"], ["manifest.json / content.js", "icons など"]),
        ("3", ["前回のフォルダへ", "上書き"], ["フォルダの場所は", "変えない"]),
        ("4", ["拡張機能を", "再読み込み"], ["Chrome / Edge の", "拡張機能ページで更新"]),
    ]
    x = 62
    y = 215
    card_w = 252
    card_h = 205
    for i, (num, title_lines, note_lines) in enumerate(cards):
        cx = x + i * 282
        rounded(draw, (cx, y, cx + card_w, y + card_h), "#ffffff", LINE, 2, 20)
        draw.ellipse((cx + 22, y + 26, cx + 78, y + 82), fill=BLUE)
        centered(draw, (cx + 22, y + 26, cx + 78, y + 82), num, F["small_bold"], "#ffffff")
        multiline(draw, cx + 28, y + 98, title_lines, F["body_bold"], INK, 6)
        multiline(draw, cx + 28, y + 156, note_lines, F["tiny"], MUTED, 6)
        if i < len(cards) - 1:
            arrow(draw, cx + card_w + 14, y + 102, cx + card_w + 48)

    warn = (164, 485, 1036, 575)
    rounded(draw, warn, "#fff7ed", "#fdba74", 2, 18)
    draw.text((204, 512), "注意", font=F["body_bold"], fill="#9a3412")
    draw.text((284, 512), "解凍したフォルダごと入れるのではなく、その中身を既存フォルダへ上書きします。", font=F["body"], fill=INK)
    img.save(ASSETS / "v013-update-flow.png")


def draw_install_targets():
    img, draw = base(
        "表示される場所",
        "まさおの家のライブアーカイブだけに表示されるようにしています",
    )

    left = (82, 212, 566, 546)
    right = (634, 212, 1118, 546)
    rounded(draw, left, "#ffffff", LINE, 2, 24)
    rounded(draw, right, "#ffffff", LINE, 2, 24)
    badge(draw, 118, 248, "表示する", GREEN)
    draw.text((118, 320), "まさおの家", font=F["title"], fill=INK)
    draw.text((118, 386), "ライブアーカイブ", font=F["body_bold"], fill=BLUE_DARK)
    draw.text((118, 438), "タイムスタンプ作成のときだけ使えます", font=F["small"], fill=MUTED)

    badge(draw, 670, 248, "表示しない", RED)
    draw.text((670, 320), "他チャンネル", font=F["title"], fill=INK)
    draw.text((670, 386), "通常動画 / 配信中ライブ / Shorts", font=F["body_bold"], fill=RED)
    draw.text((670, 438), "邪魔になりにくく、誤操作を避けられます", font=F["small"], fill=MUTED)
    img.save(ASSETS / "v013-targets.png")


if __name__ == "__main__":
    draw_time_adjust()
    draw_update_flow()
    draw_install_targets()
    print(ASSETS)
