import { createNoise2D } from 'simplex-noise'
import alea from 'alea'

export function setupStarField(canvas) {
  // Get the drawing context
  const ctx = canvas.getContext('2d')
  
  // Make sure the canvas renders with crisp pixels, no anti-aliasing
  ctx.imageSmoothingEnabled = false
  
  // Generate a seed based on the current date
  // This ensures the starfield stays the same throughout the day, but changes daily
  function generateDailySeed() {
    const date = new Date()
    const year = date.getFullYear()
    const month = date.getMonth()
    const day = date.getDate()
    
    // Create a seed string based on date - ignoring time components
    return `starfield-${year}-${month}-${day}`
  }
  
  // Create a seeded random number generator
  const prng = alea(generateDailySeed())
  
  // Create the noise generator with the seeded PRNG
  const noise2D = createNoise2D(prng)
  
  // Create a wrapper for our seeded random function
  // This will replace all Math.random() calls in our star generation
  const seededRandom = () => prng()
  
  console.log(`Created starfield with seed: ${generateDailySeed()}`)
  
  // Star settings
  const stars = []
  let starCount = 0 // Will be calculated based on canvas size
  let canvasDisplayHeight = window.innerHeight // Store the display height (not the scaled canvas height)
  
  // Shooting star settings
  const shootingStars = []
  
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
    const fadeStartY = canvasDisplayHeight * 0.1 // Start fading from 20% down
    const fadeEndY = canvasDisplayHeight * 0.99  // Complete fade by 70% down
    
    if (y < fadeStartY) {
      return 1.0; // No fade above the start point
    } else if (y > fadeEndY) {
      return 0.0; // Fully faded below the end point
    } else {
      // Linear interpolation between start and end
      return 1.0 - ((y - fadeStartY) / (fadeEndY - fadeStartY));
    }
  }
  
  // Create a new shooting star with seeded random starting position
  function createShootingStar() {
    // Simply use random positioning - no noise-based placement
    // But use seeded random for consistency with the daily seed
    const startX = seededRandom() * window.innerWidth
    const startY = seededRandom() * (window.innerHeight * 0.3) // Start in top 30% of screen
    
    // Fixed angle (diagonal downward direction)
    const angle = Math.PI / 4 // 45 degrees
    
    // Create speed (pixels per frame) using seeded random
    const speed = 5 + seededRandom() * 8
    
    // Calculate total travel distance (for lifecycle calculations)
    const maxTravel = Math.max(window.innerWidth, window.innerHeight) * 1.5
    
    // Add to shooting stars array
    shootingStars.push({
      x: startX,
      y: startY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      maxAlpha: 0.8 + seededRandom() * 0.2, // Maximum brightness
      tailLength: 30 + seededRandom() * 30, // Length of tail
      distanceTraveled: 0, // Track distance traveled
      maxTravel: maxTravel, // Maximum travel distance
      active: true,
      shimmerPixels: [] // Array to store shimmering tail pixels that persist
    })
  }
  
  // Update shooting stars
  function updateShootingStars() {
    for (let i = shootingStars.length - 1; i >= 0; i--) {
      const star = shootingStars[i]
      
      // Move the shooting star
      star.x += star.vx
      star.y += star.vy
      
      // Calculate distance traveled this frame
      const distanceThisFrame = Math.sqrt(star.vx * star.vx + star.vy * star.vy)
      star.distanceTraveled += distanceThisFrame
      
      // Update shimmer pixels (fade them out gradually)
      if (star.shimmerPixels) {
        for (let j = star.shimmerPixels.length - 1; j >= 0; j--) {
          const pixel = star.shimmerPixels[j]
          
          // Use the pixel's own decay rate for more varied effects
          // Some pixels will linger much longer than others
          pixel.alpha *= pixel.decay * 0.97 || 0.97
          
          // Remove very faint pixels
          if (pixel.alpha < 0.03) {
            star.shimmerPixels.splice(j, 1)
          }
        }
      }
      
      // Keep the shooting star if it still has visible shimmer pixels
      const hasVisibleShimmer = star.shimmerPixels && star.shimmerPixels.length > 0
      
      // Remove if out of bounds or if traveled maximum distance and has no visible shimmer
      if ((star.x < 0 || star.x > window.innerWidth || 
          star.y < 0 || star.y > window.innerHeight ||
          star.distanceTraveled > star.maxTravel) && !hasVisibleShimmer) {
        shootingStars.splice(i, 1)
      }
    }
  }
  
  // Draw shooting stars
  function drawShootingStars() {
    shootingStars.forEach(star => {
      // Get horizon fade factor for the star head position
      const headFadeFactor = getFadeFactor(star.y)
      
      // If the star is beyond the fade horizon, skip drawing
      if (headFadeFactor <= 0.01) return
      
      // Calculate lifecycle-based alpha
      // Stars start dim, brighten in the middle, and fade at the end
      const introPhase = 0.15; // First 15% of travel
      const outroPhase = 0.7;  // After 70% of travel
      
      let lifecycleFactor = 1.0;
      const progress = star.distanceTraveled / star.maxTravel;
      
      if (progress < introPhase) {
        // Fade in - start at 0, ramp up to 1
        lifecycleFactor = progress / introPhase;
      } else if (progress > outroPhase) {
        // Fade out - start at 1, decrease to 0
        lifecycleFactor = 1.0 - ((progress - outroPhase) / (1.0 - outroPhase));
      }
      
      // Current alpha based on lifecycle and max brightness
      const currentAlpha = star.maxAlpha * lifecycleFactor;
      
      // Draw the shooting star with a pixel art style tail
      const tailLength = Math.floor(star.tailLength)
      const startX = Math.floor(star.x)
      const startY = Math.floor(star.y)
      
      // Define normalized direction vector for pixel-perfect drawing
      const length = Math.sqrt(star.vx * star.vx + star.vy * star.vy)
      const dx = star.vx / length
      const dy = star.vy / length
      
      // Draw tail pixels with fading alpha
      for (let i = 0; i < tailLength; i++) {
        // Calculate position
        const x = Math.floor(startX - dx * i)
        const y = Math.floor(startY - dy * i)
        
        // Get horizon fade factor for this tail segment
        const tailFadeFactor = getFadeFactor(y)
        
        // Calculate alpha (fading toward the end of the tail)
        const pixelAlpha = currentAlpha * (1 - i / tailLength) * tailFadeFactor
        
        // Only draw if alpha is visible
        if (pixelAlpha > 0.05) {
          ctx.fillStyle = `rgba(255, 255, 255, ${pixelAlpha})`
          ctx.fillRect(x, y, 1, 1) // 1px wide pixel
          
          // Create many more shimmer pixels, especially at the end of the tail
          // This creates the effect of pixels lingering after the star passes
          const tailEndSection = i > (tailLength * 0.6); // Last 40% of the tail
          
          // Much higher chance of shimmer pixels - especially at the end of the tail
          if (Math.random() < (tailEndSection ? 0.4 : 0.08)) {
            // Add a pixel to the shimmer array that will persist
            star.shimmerPixels.push({
              x: x,
              y: y,
              alpha: pixelAlpha * (tailEndSection ? 1.2 : 0.9), // Brighter at the end
              decay: Math.random() < 0.5 ? 0.985 : 0.97 // Much slower decay for more visible lingering
            });
          }
        }
      }
      
      // Draw shimmer pixels
      if (star.shimmerPixels && star.shimmerPixels.length > 0) {
        for (const pixel of star.shimmerPixels) {
          const shimmerFadeFactor = getFadeFactor(pixel.y);
          const finalAlpha = pixel.alpha * shimmerFadeFactor;
          
          if (finalAlpha > 0.02) {
            ctx.fillStyle = `rgba(255, 255, 255, ${finalAlpha})`;
            ctx.fillRect(pixel.x, pixel.y, 1, 1);
          }
        }
      }
      
      // Draw the star "head" as a plus sign (+)
      const headAlpha = currentAlpha * headFadeFactor
      if (headAlpha > 0.05) {
        ctx.fillStyle = `rgba(255, 255, 255, ${headAlpha})`
        // Horizontal line
        ctx.fillRect(startX - 1, startY, 3, 1)
        // Vertical line
        ctx.fillRect(startX, startY - 1, 1, 3)
      }
    })
  }
  
  // Draw the stars on the canvas
  function drawStars() {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    // Draw background stars
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
    
    // Draw shooting stars on top
    drawShootingStars()
  }
  
  // Create stars using a hybrid approach for natural clustering
  function createStars() {
    stars.length = 0 // Clear existing stars
    
    // Create two different noise scales for different effects
    // Using larger scale values to create smaller clusters
    const largeStructureScale = 0.0025   // Smaller clusters (was 0.001)
    const mediumStructureScale = 0.01    // Finer details (was 0.005)
    
    // Keep track of total sample attempts for more stars in cluster areas
    let totalSampleAttempts = 0
    const maxTotalAttempts = window.innerWidth * window.innerHeight / 100
    
    // Variable minimum distance depending on noise value
    // Lower distances (denser packing) allowed in cluster centers
    const baseMinDistance = 12
    const minDistanceVariation = 8  // How much the distance can vary
    
    // Function to calculate minimum distance at a point
    function getMinDistanceAtPoint(x, y) {
      // Get large-scale structure noise
      const structureNoise = (noise2D(x * largeStructureScale, y * largeStructureScale) + 1) / 2
      
      // In cluster centers (high noise), allow stars to be closer
      // In empty areas (low noise), keep stars further apart
      return baseMinDistance - (structureNoise * minDistanceVariation) + seededRandom() * 3
    }
    
    // Function to check if a position is too close to existing stars
    function isPositionValid(x, y, minDist) {
      for (const star of stars) {
        const dx = x - star.x
        const dy = y - star.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        
        // If this position is too close to an existing star, reject it
        if (distance < minDist) {
          return false
        }
      }
      return true
    }
    
    // Calculate probability of adding a star based on noise value
    function getProbabilityFromNoise(noiseValue) {
      // Apply a curve to the noise to create more distinct but natural clustering
      // Higher values = more probability variation between high/low noise regions
      const contrast = 4.237
      
      // Apply contrast curve to noise (higher contrast = more distinct clusters)
      // This creates a steeper probability curve
      return Math.pow(noiseValue, contrast)
    }
    
    // Calculate base star density for this screen size
    const totalSamples = Math.floor((window.innerWidth * window.innerHeight) / 100)
    
    // Create stars using varying density based on noise
    while (totalSampleAttempts < maxTotalAttempts && stars.length < totalSamples) {
      totalSampleAttempts++
      
      // Generate a random position using seeded random
      const x = seededRandom() * window.innerWidth
      const y = seededRandom() * window.innerHeight
      
      // Get noise value at this position - blend multiple scales
      const largeScaleNoise = (noise2D(x * largeStructureScale, y * largeStructureScale) + 1) / 2
      const mediumScaleNoise = (noise2D(x * mediumStructureScale, y * mediumStructureScale) + 1) / 2
      
      // Blend noise scales with different weights
      const blendedNoise = largeScaleNoise * 0.75 + mediumScaleNoise * 0.25 + seededRandom() * 0.05
      
      // Calculate probability of placing a star here
      const probability = getProbabilityFromNoise(blendedNoise)
      
      // Add some randomness to break up patterns (20% random)
      const effectiveProbability = probability * 0.9 + seededRandom() * 0.2
      
      // Apply probability check - higher noise = higher chance of a star
      if (seededRandom() < effectiveProbability) {
        // Get the minimum distance for this position
        const minDist = getMinDistanceAtPoint(x, y)
        
        // Add slight jitter to position
        const jitterAmount = 2 // Smaller jitter
        const jitterX = x + (seededRandom() * 2 - 1) * jitterAmount
        const jitterY = y + (seededRandom() * 2 - 1) * jitterAmount
        
        // Only add if it's not too close to existing stars
        if (isPositionValid(jitterX, jitterY, minDist)) {
          // Determine star type and brightness based on noise
          let typeIndex, brightness
          
          // Higher probability of plus-shaped bright stars in cluster centers, but fewer 2x2 stars
          if (blendedNoise > 0.85 && seededRandom() < 0.3) {
            // Sparse large bright stars in dense areas (mostly plus shapes, fewer 2x2)
            typeIndex = seededRandom() < 0.6 ? 2 : 1
            brightness = 0.7 + seededRandom() * 0.3
          } else if (blendedNoise > 0.7 && seededRandom() < 0.2) {
            // Medium stars in clusters
            typeIndex = seededRandom() < 0.3 ? 1 : 0  // Only 30% chance of 2x2, 70% chance of 1x1
            brightness = 0.5 + seededRandom() * 0.4
          } else {
            // Add occasional large bright stars outside of clusters
            if (seededRandom() < 0.03) { // 3% chance of large bright stars outside clusters
              // Bright, isolated stars (plus-shaped or 2x2)
              typeIndex = seededRandom() < 0.5 ? 2 : 1
              brightness = 0.8 + seededRandom() * 0.2  // Very bright
            } else {
              // Most stars are the small 1x1 pixels
              typeIndex = 0
              brightness = 0.2 + seededRandom() * 0.4
            }
          }
          
          stars.push({
            x: jitterX,
            y: jitterY,
            type: starTypes[typeIndex],
            brightness: brightness,
            blinkSpeed: 0.01 + seededRandom() * 0.001,
            blinkDirection: seededRandom() > 0.5 ? 1 : -1
          })
        }
      }
    }
    
    // Update star count
    starCount = stars.length
    
    console.log(`Created ${starCount} stars with natural clustering`)
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
        // We use Math.random here (not seeded) since we want the twinkling to be different each time
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
    updateShootingStars()
    drawStars()
    requestAnimationFrame(animate)
  }
  
  // Create a shooting star at regular intervals
  function startShootingStarTimer() {
    // We won't use seededRandom for the timer since we want different timing on each page load
    // But we'll still create a consistent star pattern each time due to the seed
    setInterval(() => {
      createShootingStar()
    }, Math.random() * (15000 - 9000) + 9000)
  }
  
  // Initialize everything
  window.addEventListener('resize', resizeCanvas)
  resizeCanvas() // This will also create the initial stars
  startShootingStarTimer() // Start creating shooting stars
  animate()

  return {
    resize: resizeCanvas,
    redraw: drawStars
  }
}
