import { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Image, Rect, Transformer } from 'react-konva';

const CropRect = ({ shapeProps, isSelected, onSelect, onChange, isLocked }) => {
  const shapeRef = useRef();
  const trRef = useRef();

  useEffect(() => {
    if (isSelected) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  return (
    <>
      <Rect
        {...shapeProps}
        ref={shapeRef}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        stroke={isSelected ? "#00ff00" : "#00cc00"}
        strokeWidth={2}
        dash={[5, 5]}
        onDragEnd={(e) => {
          onChange({
            ...shapeProps,
            x: e.target.x(),
            y: e.target.y(),
          }, e);
        }}
        onTransformEnd={(e) => {
          const node = shapeRef.current;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();
          const rotation = node.rotation();

          node.scaleX(1);
          node.scaleY(1);
          
          let newWidth = Math.max(5, node.width() * scaleX);
          let newHeight = Math.max(5, node.height() * scaleY);

          if (isLocked) {
            const size = Math.max(newWidth, newHeight);
            newWidth = size;
            newHeight = size;
          }

          onChange({
            ...shapeProps,
            x: node.x(),
            y: node.y(),
            width: newWidth,
            height: newHeight,
            rotation: rotation,
          });
        }}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          boundBoxFunc={(oldBox, newBox) => {
            if (isLocked) {
              const size = Math.max(newBox.width, newBox.height);
              return {
                ...newBox,
                width: size,
                height: size,
              };
            }
            return {
              ...newBox,
              width: Math.max(5, newBox.width),
              height: Math.max(5, newBox.height),
            };
          }}
          rotateEnabled={true}
        />
      )}
    </>
  );
};

const ImageEditor = () => {
  const [image, setImage] = useState(null);
  const [cropRects, setCropRects] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [scale, setScale] = useState(1);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [imagePos, setImagePos] = useState({ x: 0, y: 0 });
  const [isLocked, setIsLocked] = useState(true);
  const [history, setHistory] = useState([]);
  const [currentStep, setCurrentStep] = useState(-1);
  const stageRef = useRef();
  const containerRef = useRef();
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });

  const addToHistory = (rects) => {
    const newHistory = history.slice(0, currentStep + 1);
    newHistory.push(rects);
    setHistory(newHistory);
    setCurrentStep(newHistory.length - 1);
  };

  const undo = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setCropRects(history[currentStep - 1]);
    }
  };

  const redo = () => {
    if (currentStep < history.length - 1) {
      setCurrentStep(currentStep + 1);
      setCropRects(history[currentStep + 1]);
    }
  };

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setStageSize({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Undo
      if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
      }
      // Redo
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        redo();
      }
      // Delete selected rectangles when Delete key is pressed
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
        e.preventDefault();
        const newRects = cropRects.filter(rect => !selectedIds.includes(rect.id));
        setCropRects(newRects);
        setSelectedIds([]);
        addToHistory(newRects);
      }
      // Duplicate selected with Alt
      if (e.altKey && selectedIds.length > 0) {
        const newRects = [...cropRects];
        const newSelectedIds = [];
        
        selectedIds.forEach(id => {
          const selectedRect = cropRects.find(rect => rect.id === id);
          if (selectedRect) {
            const newRect = {
              ...selectedRect,
              id: `crop${cropRects.length + newSelectedIds.length + 1}`,
              x: selectedRect.x + 20,
              y: selectedRect.y + 20,
            };
            newRects.push(newRect);
            newSelectedIds.push(newRect.id);
          }
        });
        
        setCropRects(newRects);
        setSelectedIds(newSelectedIds);
        addToHistory(newRects);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cropRects, selectedIds, currentStep, history]);

  const handleSelect = (e) => {
    e.cancelBubble = true;

    const id = e.target.attrs.id;
    
    if (e.evt.shiftKey) {
      // Multi-select with Shift
      const newSelectedIds = selectedIds.includes(id)
        ? selectedIds.filter(selectedId => selectedId !== id)
        : [...selectedIds, id];
      setSelectedIds(newSelectedIds);
    } else {
      // Single select
      setSelectedIds([id]);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new window.Image();
        img.src = e.target.result;
        img.onload = () => {
          setImage(img);
          
          const aspectRatio = img.width / img.height;
          const maxWidth = stageSize.width * 0.8;
          const maxHeight = stageSize.height * 0.8;
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            width = maxWidth;
            height = width / aspectRatio;
          }
          if (height > maxHeight) {
            height = maxHeight;
            width = height * aspectRatio;
          }

          const x = (stageSize.width - width) / 2;
          const y = (stageSize.height - height) / 2;

          setImageSize({ width, height });
          setImagePos({ x, y });
          setScale(width / img.width);

          const cropSize = Math.min(width, height) * 0.8;
          const initialRects = [{
            x: x + (width - cropSize) / 2,
            y: y + (height - cropSize) / 2,
            width: cropSize,
            height: cropSize,
            rotation: 0,
            id: 'crop1',
          }];
          
          setCropRects(initialRects);
          setHistory([initialRects]);
          setCurrentStep(0);
          setSelectedIds(['crop1']);
        };
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleLock = () => {
    setIsLocked(!isLocked);
    if (!isLocked) {
      const newRects = cropRects.map(rect => {
        const size = Math.min(rect.width, rect.height);
        return {
          ...rect,
          width: size,
          height: size,
        };
      });
      setCropRects(newRects);
      addToHistory(newRects);
    }
  };

  const handleCrop = () => {
    if (!image || cropRects.length === 0) return;

    cropRects.forEach((cropRect, index) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // Set fixed output size
      canvas.width = 128;
      canvas.height = 128;

      // Calculate the relative position of crop rect to image
      const relativeX = (cropRect.x - imagePos.x) / imageSize.width;
      const relativeY = (cropRect.y - imagePos.y) / imageSize.height;
      const relativeWidth = cropRect.width / imageSize.width;
      const relativeHeight = cropRect.height / imageSize.height;

      // Clear canvas with white background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Save context state
      ctx.save();

      // Move to center of canvas
      ctx.translate(canvas.width / 2, canvas.height / 2);
      
      // Apply rotation
      ctx.rotate((cropRect.rotation * Math.PI) / 180);

      // Draw the image
      ctx.drawImage(
        image,
        relativeX * image.width,
        relativeY * image.height,
        relativeWidth * image.width,
        relativeHeight * image.height,
        -canvas.width / 2,
        -canvas.height / 2,
        canvas.width,
        canvas.height
      );

      // Restore context
      ctx.restore();

      // Create download link
      const link = document.createElement('a');
      link.download = `cropped-image-${index + 1}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    });
  };

  const handleZoom = (event) => {
    event.preventDefault();
    const scaleBy = 1.1;
    const stage = stageRef.current;
    const oldScale = scale;

    const pointer = stage.getPointerPosition();

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const newScale = event.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;

    setScale(newScale);

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };

    stage.position(newPos);
    stage.batchDraw();
  };

  const handleRectChange = (newAttrs, dragEvent = null) => {
    let newRects = [...cropRects];
    
    // If this is a drag event and we have multiple selections
    if (dragEvent && selectedIds.length > 1) {
      const deltaX = dragEvent.target.x() - cropRects.find(r => r.id === newAttrs.id).x;
      const deltaY = dragEvent.target.y() - cropRects.find(r => r.id === newAttrs.id).y;
      
      // Update all selected rectangles
      newRects = cropRects.map(rect => {
        if (selectedIds.includes(rect.id)) {
          return {
            ...rect,
            x: rect.x + deltaX,
            y: rect.y + deltaY,
          };
        }
        return rect;
      });
    } else {
      // Handle single rectangle changes
      newRects = cropRects.map(rect =>
        rect.id === newAttrs.id ? newAttrs : rect
      );
    }
    
    setCropRects(newRects);
    addToHistory(newRects);
  };

  return (
    <div className="w-screen h-screen flex flex-col bg-gray-900">
      <div className="bg-gray-800 p-4 flex items-center gap-4">
        <input
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="block text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
        />
        {image && (
          <>
            <button
              onClick={undo}
              disabled={currentStep <= 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Undo
            </button>
            <button
              onClick={redo}
              disabled={currentStep >= history.length - 1}
              className="px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Redo
            </button>
            <button
              onClick={toggleLock}
              className={`px-4 py-2 rounded-full transition-colors ${
                isLocked 
                ? 'bg-yellow-600 hover:bg-yellow-700 text-white' 
                : 'bg-gray-600 hover:bg-gray-700 text-white'
              }`}
            >
              {isLocked ? 'Unlock' : 'Lock Square'}
            </button>
            <button
              onClick={handleCrop}
              className="px-4 py-2 bg-green-600 text-white rounded-full hover:bg-green-700 transition-colors"
            >
              Save All Crops (128×128)
            </button>
            <div className="text-gray-400 text-sm space-y-1">
              <div>Hold Alt to duplicate selected areas</div>
              <div>Hold Shift + Click to select multiple areas</div>
              <div>Ctrl+Z: Undo | Ctrl+Shift+Z: Redo</div>
            </div>
          </>
        )}
      </div>

      <div 
        ref={containerRef} 
        className="flex-1 overflow-hidden"
        onWheel={handleZoom}
      >
        <Stage
          width={stageSize.width}
          height={stageSize.height}
          ref={stageRef}
          onMouseDown={(e) => {
            // Deselect when clicking on empty stage area
            const clickedOnEmpty = e.target === e.target.getStage();
            if (clickedOnEmpty) {
              setSelectedIds([]);
            }
          }}
          scale={{ x: scale, y: scale }}
          draggable
        >
          <Layer>
            {image && (
              <Image
                image={image}
                x={imagePos.x}
                y={imagePos.y}
                width={imageSize.width}
                height={imageSize.height}
              />
            )}
            {cropRects.map((rectProps) => (
              <CropRect
                key={rectProps.id}
                shapeProps={{...rectProps, id: rectProps.id}}
                isSelected={selectedIds.includes(rectProps.id)}
                onSelect={handleSelect}
                onChange={handleRectChange}
                isLocked={isLocked}
              />
            ))}
          </Layer>
        </Stage>
      </div>
    </div>
  );
};

export default ImageEditor;
