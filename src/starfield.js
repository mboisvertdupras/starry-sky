export function setupStarField(canvas) {
  // Get the drawing context
  const ctx = canvas.getContext('2d')
  
  // Make sure the canvas renders with crisp pixels, no anti-aliasing
  ctx.imageSmoothingEnabled = false
  
  // Star settings
  const stars = []
  let starCount = 0 // Will be calculated based on canvas size
  let canvasDisplayHeight = window.innerHeight // Store the display height (not the scaled canvas height)
  
  // Star types (pixel art style)
  const starTypes = [
    // 1x1 pixel
    { 
      size: 1,
      draw: (x, y, alpha) => {
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`
        ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1)
      }
    },
    // 2x2 pixel
    { 
      size: 2,
      draw: (x, y, alpha) => {
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`
        ctx.fillRect(Math.floor(x), Math.floor(y), 2, 2)
      }
    },
    // Plus shape (+)
    { 
      size: 3,
      draw: (x, y, alpha) => {
        const fx = Math.floor(x)
        const fy = Math.floor(y)
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`
        ctx.fillRect(fx, fy + 1, 3, 1) // Horizontal line
        ctx.fillRect(fx + 1, fy, 1, 3) // Vertical line
      }
    }
  ]
  
  // Calculate fade factor based on y position
  function getFadeFactor(y) {
    // Use the logical/CSS height for calculations
    const fadeStartY = canvasDisplayHeight * 0.2 // Start fading from 20% down
    const fadeEndY = canvasDisplayHeight * 0.7  // Complete fade by 70% down
    
    if (y < fadeStartY) {
      return 1.0; // No fade above the start point
    } else if (y > fadeEndY) {
      return 0.0; // Fully faded below the end point
    } else {
      // Linear interpolation between start and end
      return 1.0 - ((y - fadeStartY) / (fadeEndY - fadeStartY));
    }
  }
  
  // Draw the stars on the canvas
  function drawStars() {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    stars.forEach(star => {
      // Calculate base brightness
      let alpha = 0.4 + star.brightness * 0.6;
      
      // Apply horizon fade effect
      const fadeFactor = getFadeFactor(star.y);
      alpha *= fadeFactor;
      
      // Only draw if star is visible
      if (alpha > 0.01) {
        // Draw the star using its type
        star.type.draw(star.x, star.y, alpha);
      }
    })
  }
  
  // Create stars with random positions and properties
  function createStars() {
    stars.length = 0 // Clear existing stars
    
    // Calculate responsive star density using the display dimensions, not the scaled canvas dimensions
    starCount = Math.floor((window.innerWidth * window.innerHeight) / 700)
    
    for (let i = 0; i < starCount; i++) {
      // Generate random positions using display dimensions
      const x = Math.random() * window.innerWidth
      const y = Math.random() * window.innerHeight
      
      // Randomly select star type with weighting (more small stars than large)
      const typeIndex = Math.random() < 0.7 ? 0 : (Math.random() < 0.8 ? 1 : 2)
      
      stars.push({
        x: x,
        y: y,
        type: starTypes[typeIndex],
        brightness: Math.random(),
        blinkSpeed: 0.02 + Math.random() * 0.04, // Increased speed for faster twinkling
        blinkDirection: Math.random() > 0.5 ? 1 : -1
      })
    }
  }
  
  // Update star properties for animation
  function updateStars() {
    stars.forEach(star => {
      // Make stars twinkle by changing brightness
      star.brightness += star.blinkDirection * star.blinkSpeed
      
      // Reverse direction when reaching brightness limits
      // Using narrower range (0.2-0.9) for more pronounced twinkling
      if (star.brightness <= 0.2 || star.brightness >= 0.9) {
        star.blinkDirection *= -1
        
        // Small chance to dramatically change brightness to simulate atmospheric flicker
        if (Math.random() < 0.1) {
          star.brightness = 0.3 + Math.random() * 0.6; // Random jump in brightness
          star.blinkSpeed = 0.02 + Math.random() * 0.04; // Randomize speed again
        }
      }
    })
  }
  
  // Set canvas size to full window
  const resizeCanvas = () => {
    // Update the display height
    canvasDisplayHeight = window.innerHeight;
    
    // Set canvas size in a way that ensures pixel-perfect rendering
    const dpr = window.devicePixelRatio || 1
    
    // Clear previous scaling
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    
    // Set canvas dimensions accounting for device pixel ratio
    canvas.width = window.innerWidth * dpr
    canvas.height = window.innerHeight * dpr
    
    // Set display size
    canvas.style.width = window.innerWidth + 'px'
    canvas.style.height = window.innerHeight + 'px'
    
    // Scale the context to ensure pixel-perfect rendering
    ctx.scale(dpr, dpr)
    
    // Reset rendering options
    ctx.imageSmoothingEnabled = false
    
    createStars() // Create new stars when canvas resizes
    drawStars()   // Draw them immediately
  }
  
  // Animation loop
  function animate() {
    updateStars()
    drawStars()
    requestAnimationFrame(animate)
  }
  
  // Initialize everything
  window.addEventListener('resize', resizeCanvas)
  resizeCanvas() // This will also create the initial stars
  animate()

  return {
    // Return methods for external control if needed
    resize: resizeCanvas,
    redraw: drawStars
  }
}
