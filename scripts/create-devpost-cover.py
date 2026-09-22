"""Create a 3:2 Devpost JPEG using existing SecondCrate brand artwork."""

from pathlib import Path
import os
from PIL import Image, ImageDraw, ImageFont

root = Path.cwd()
runtime = Path(os.environ.get(
    "CODEX_ARTIFACT_RUNTIME",
    str(Path.home() / ".cache/codex-runtimes/codex-primary-runtime/dependencies"),
))
fonts = runtime / "node/node_modules/pdfjs-dist/standard_fonts"
source = Image.open(root / "docs/assets/secondcrate-cover.png").convert("RGB")
forest = source.getpixel((10, 10))
cream = "#f7f8f5"
lime = "#d4e9a8"
image = Image.new("RGB", (1500, 1000), forest)
draw = ImageDraw.Draw(image)


def font(size, bold=False):
    name = "LiberationSans-Bold.ttf" if bold else "LiberationSans-Regular.ttf"
    return ImageFont.truetype(str(fonts / name), size)


def text(position, value, size, color, bold=False):
    draw.text(position, value, font=font(size, bold), fill=color, anchor="lt")


# Preserve the repository-owned illustration, cropping only its plain background.
art = source.crop((800, 240, 1380, 590)).resize((700, 423), Image.Resampling.LANCZOS)
image.paste(art, (750, 300))
text((90, 90), "SecondCrate", 108, cream, True)
text((95, 286), "Every good lot", 64, lime, True)
text((95, 366), "deserves a buyer", 64, lime, True)
text((97, 538), "Recovery for cancelled", 38, cream)
text((97, 589), "wholesale produce orders", 38, cream)
text((98, 808), "Created by Shivam Gupta", 28, lime, True)
text((98, 861), "secondcrate.web.app", 36, cream)
text((1005, 892), "PRODUCT REHEARSAL", 23, lime, True)
output = root / "deliverables/SecondCrate-Devpost-Cover.jpg"
image.save(output, quality=96, subsampling=0, optimize=True)
assert Image.open(output).size == (1500, 1000)
print(f"Created {output.name}: 1500 x 1000, JPEG, exact 3:2 ratio.")
