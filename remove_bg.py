import sys
from PIL import Image
import numpy as np

try:
    img = Image.open(r'C:\Users\hp\.gemini\antigravity-ide\brain\b77e7691-f874-4a08-a11a-c8ee075f6257\real_banana_1788433900380.jpg').convert('RGBA')
    data = np.array(img)

    r, g, b, a = data.T
    # Simple green screen removal: Green > 150 and Green > Red * 1.2 and Green > Blue * 1.2
    green_screen = (g > 150) & (g > r * 1.2) & (g > b * 1.2)
    
    # Apply mask
    data[..., 3][green_screen.T] = 0

    Image.fromarray(data).save(r'c:\Users\hp\Desktop\projects\live-chat\public\masks\real_banana.png')
    print('Successfully created transparent banana!')
except Exception as e:
    print('Error:', e)
