#!/usr/bin/env python3

import os
import sys
import glob
import math
from xml.etree import ElementTree as ET

def find_radial_overlay_files(directory):
    """Find all radial_overlay.svg files in the given directory."""
    pattern = os.path.join(directory, "*_radial_overlay.svg")
    files = glob.glob(pattern)
    return sorted(files)

def get_svg_dimensions(svg_path):
    """Extract width and height from SVG file."""
    try:
        tree = ET.parse(svg_path)
        root = tree.getroot()
        
        # Try to get dimensions from width/height attributes
        width = root.get('width')
        height = root.get('height')
        
        if width and height:
            # Remove units if present (px, pt, etc.)
            width = float(''.join(c for c in width if c.isdigit() or c == '.'))
            height = float(''.join(c for c in height if c.isdigit() or c == '.'))
            return width, height
        
        # Fallback to viewBox if no width/height
        viewbox = root.get('viewBox')
        if viewbox:
            _, _, width, height = map(float, viewbox.split())
            return width, height
            
        # Default fallback
        return 400, 400
        
    except Exception as e:
        print(f"Warning: Could not parse {svg_path}: {e}")
        return 400, 400

def calculate_grid_layout(num_items):
    """Calculate optimal grid layout for given number of items."""
    if num_items <= 0:
        return 0, 0
    
    # Calculate rows and columns for roughly square grid
    cols = math.ceil(math.sqrt(num_items))
    rows = math.ceil(num_items / cols)
    
    return rows, cols

def create_composite_svg(svg_files, output_path):
    """Create a composite SVG with all input SVGs arranged in a grid."""
    if not svg_files:
        print("No SVG files to composite")
        return
    
    # A3 landscape dimensions in points (842 x 595)
    page_width = 842
    page_height = 595
    margin = 20
    
    # Calculate grid layout
    rows, cols = calculate_grid_layout(len(svg_files))
    
    # Calculate cell dimensions
    cell_width = (page_width - 2 * margin) / cols
    cell_height = (page_height - 2 * margin) / rows
    
    # Create root SVG element
    root = ET.Element('svg')
    root.set('xmlns', 'http://www.w3.org/2000/svg')
    root.set('width', str(page_width))
    root.set('height', str(page_height))
    root.set('viewBox', f'0 0 {page_width} {page_height}')
    
    # Add background
    bg = ET.SubElement(root, 'rect')
    bg.set('width', str(page_width))
    bg.set('height', str(page_height))
    bg.set('fill', 'white')
    
    # Process each SVG file
    for i, svg_file in enumerate(svg_files):
        row = i // cols
        col = i % cols
        
        # Calculate position
        x = margin + col * cell_width
        y = margin + row * cell_height
        
        try:
            # Parse the source SVG
            tree = ET.parse(svg_file)
            source_root = tree.getroot()
            
            # Get original dimensions
            orig_width, orig_height = get_svg_dimensions(svg_file)
            
            # Calculate scale to fit in cell (with padding)
            padding = 10
            available_width = cell_width - 2 * padding
            available_height = cell_height - 2 * padding
            
            scale_x = available_width / orig_width
            scale_y = available_height / orig_height
            scale = min(scale_x, scale_y)
            
            # Calculate centered position within cell
            scaled_width = orig_width * scale
            scaled_height = orig_height * scale
            center_x = x + (cell_width - scaled_width) / 2
            center_y = y + (cell_height - scaled_height) / 2
            
            # Create group for this SVG
            group = ET.SubElement(root, 'g')
            group.set('transform', f'translate({center_x},{center_y}) scale({scale})')
            
            # Copy all child elements from source SVG
            for child in source_root:
                if child.tag.split('}')[-1] not in ['title', 'desc', 'metadata']:
                    group.append(child)
            
            # Add filename label
            text = ET.SubElement(root, 'text')
            text.set('x', str(x + cell_width/2))
            text.set('y', str(y + cell_height - 5))
            text.set('text-anchor', 'middle')
            text.set('font-family', 'Arial, sans-serif')
            text.set('font-size', '8')
            text.set('fill', 'black')
            filename = os.path.basename(svg_file).replace('_radial_overlay.svg', '')
            text.text = filename
            
        except Exception as e:
            print(f"Error processing {svg_file}: {e}")
            # Add error placeholder
            error_rect = ET.SubElement(root, 'rect')
            error_rect.set('x', str(x + padding))
            error_rect.set('y', str(y + padding))
            error_rect.set('width', str(cell_width - 2 * padding))
            error_rect.set('height', str(cell_height - 2 * padding))
            error_rect.set('fill', 'lightgray')
            error_rect.set('stroke', 'red')
    
    # Write the composite SVG
    tree = ET.ElementTree(root)
    tree.write(output_path, encoding='utf-8', xml_declaration=True)
    print(f"Created composite SVG: {output_path}")
    print(f"Grid layout: {rows} rows × {cols} columns")
    print(f"Total files: {len(svg_files)}")

def main():
    if len(sys.argv) != 2:
        print("Usage: python svg_compositor.py <directory>")
        print("Example: python svg_compositor.py 'Radiohead - Kid A'")
        sys.exit(1)
    
    input_dir = sys.argv[1]
    
    if not os.path.isdir(input_dir):
        print(f"Error: Directory '{input_dir}' does not exist")
        sys.exit(1)
    
    # Find all radial overlay files
    svg_files = find_radial_overlay_files(input_dir)
    
    if not svg_files:
        print(f"No *_radial_overlay.svg files found in '{input_dir}'")
        sys.exit(1)
    
    print(f"Found {len(svg_files)} radial overlay files:")
    for f in svg_files:
        print(f"  {os.path.basename(f)}")
    
    # Create output filename
    album_name = os.path.basename(input_dir.rstrip('/'))
    output_path = f"{album_name}_composite.svg"
    
    # Create composite
    create_composite_svg(svg_files, output_path)

if __name__ == "__main__":
    main()