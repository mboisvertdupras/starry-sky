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
  
  // Optimize star types - avoid creating rgba strings repeatedly
  // Pre-define a set of alpha values we'll use
  const alphaCache = {};
  function getCachedStyle(alpha) {
    // Round to 2 decimal places to limit cache size
    const roundedAlpha = Math.round(alpha * 100) / 100;
    if (!alphaCache[roundedAlpha]) {
      alphaCache[roundedAlpha] = `rgba(255, 255, 255, ${roundedAlpha})`;
    }
    return alphaCache[roundedAlpha];
  }
  
  const starTypes = [
    // 1x1 pixel
    { 
      size: 1,
      draw: (x, y, alpha) => {
        ctx.fillStyle = getCachedStyle(alpha);
        ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
      }
    },
    // 2x2 pixel
    { 
      size: 2,
      draw: (x, y, alpha) => {
        ctx.fillStyle = getCachedStyle(alpha);
        ctx.fillRect(Math.floor(x), Math.floor(y), 2, 2);
      }
    },
    // Plus shape (+)
    { 
      size: 3,
      draw: (x, y, alpha) => {
        const fx = Math.floor(x);
        const fy = Math.floor(y);
        ctx.fillStyle = getCachedStyle(alpha);
        ctx.fillRect(fx, fy + 1, 3, 1); // Horizontal line
        ctx.fillRect(fx + 1, fy, 1, 3); // Vertical line
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
  
  // Draw shooting stars - optimized version
  function drawShootingStars() {
    // Limit shimmer pixel generation to save performance
    const maxShimmerPixels = 200;
    
    // Use standard for loop instead of forEach
    const shootingStarsLen = shootingStars.length;
    for (let starIdx = 0; starIdx < shootingStarsLen; starIdx++) {
      const star = shootingStars[starIdx];
      
      // Fast inline fade factor calculation for head
      let headFadeFactor = 1.0;
      if (star.y >= fadeStartY) {
        if (star.y > fadeEndY) {
          continue; // Skip completely faded stars
        }
        headFadeFactor = 1.0 - ((star.y - fadeStartY) / fadeRange);
      }
      
      // Early exit if not visible
      if (headFadeFactor <= 0.01) continue;
      
      // Calculate lifecycle-based alpha - simplified calculation
      let lifecycleFactor;
      const progress = star.distanceTraveled / star.maxTravel;
      
      if (progress < 0.15) {
        // Fade in
        lifecycleFactor = progress / 0.15;
      } else if (progress > 0.7) {
        // Fade out
        lifecycleFactor = 1.0 - ((progress - 0.7) / 0.3);
      } else {
        // Middle - fully visible
        lifecycleFactor = 1.0;
      }
      
      // Current alpha
      const currentAlpha = star.maxAlpha * lifecycleFactor;
      
      // Calculate star drawing parameters
      const tailLength = Math.floor(star.tailLength);
      const startX = Math.floor(star.x);
      const startY = Math.floor(star.y);
      
      // Calculate direction once
      const vSqrLen = star.vx * star.vx + star.vy * star.vy;
      const length = Math.sqrt(vSqrLen);
      const dx = star.vx / length;
      const dy = star.vy / length;
      
      // Optimize shimmer pixel generation - only add new ones if we're below limit
      const shouldAddShimmer = star.shimmerPixels.length < maxShimmerPixels;
      
      // Draw tail with batch styling
      let lastAlpha = -1;
      
      // Draw tail pixels
      for (let i = 0; i < tailLength; i++) {
        // Optimization: only draw every other pixel for long tails
        if (tailLength > 20 && i % 2 !== 0 && i < tailLength * 0.7) continue;
        
        // Calculate position
        const x = Math.floor(startX - dx * i);
        const y = Math.floor(startY - dy * i);
        
        // Fast inline fade calculation
        let tailFadeFactor = 1.0;
        if (y >= fadeStartY) {
          if (y > fadeEndY) {
            continue; // Skip this pixel
          }
          tailFadeFactor = 1.0 - ((y - fadeStartY) / fadeRange);
        }
        
        // Calculate alpha
        const tailFade = 1 - i / tailLength;
        const pixelAlpha = currentAlpha * tailFade * tailFadeFactor;
        
        // Only draw visible pixels
        if (pixelAlpha > 0.05) {
          // Only change fill style if the alpha changed significantly
          // This reduces expensive ctx.fillStyle calls
          if (Math.abs(pixelAlpha - lastAlpha) > 0.05) {
            ctx.fillStyle = getCachedStyle(pixelAlpha);
            lastAlpha = pixelAlpha;
          }
          
          ctx.fillRect(x, y, 1, 1);
          
          // Optimize shimmer pixel generation - use deterministic approach
          // Only add new shimmer pixels if we're below the limit
          if (shouldAddShimmer) {
            const tailEndSection = i > (tailLength * 0.6);
            
            // Use time-based value instead of random for performance
            const shimmerSeed = (x * 0.1 + y * 0.2) % 1.0;
            if (shimmerSeed < (tailEndSection ? 0.2 : 0.04)) {
              // Add shimmer pixel
              star.shimmerPixels.push({
                x: x,
                y: y,
                alpha: pixelAlpha * (tailEndSection ? 1.2 : 0.9),
                decay: shimmerSeed < 0.5 ? 0.985 : 0.97
              });
            }
          }
        }
      }
      
      // Draw shimmer pixels - batch by alpha for performance
      if (star.shimmerPixels.length > 0) {
        // Map of alpha values to arrays of pixels with that alpha
        const alphaGroups = {};
        
        // Group pixels by alpha (rounded to 2 decimal places)
        for (let i = 0; i < star.shimmerPixels.length; i++) {
          const pixel = star.shimmerPixels[i];
          // Fast inline fade calculation
          let shimmerFadeFactor = 1.0;
          if (pixel.y >= fadeStartY) {
            if (pixel.y > fadeEndY) {
              continue; // Skip this pixel
            }
            shimmerFadeFactor = 1.0 - ((pixel.y - fadeStartY) / fadeRange);
          }
          
          const finalAlpha = pixel.alpha * shimmerFadeFactor;
          if (finalAlpha > 0.02) {
            // Round to 2 decimal places
            const roundedAlpha = Math.round(finalAlpha * 100) / 100;
            if (!alphaGroups[roundedAlpha]) {
              alphaGroups[roundedAlpha] = [];
            }
            alphaGroups[roundedAlpha].push(pixel);
          }
        }
        
        // Draw pixels grouped by alpha
        for (const alpha in alphaGroups) {
          ctx.fillStyle = getCachedStyle(parseFloat(alpha));
          const pixels = alphaGroups[alpha];
          for (let i = 0; i < pixels.length; i++) {
            const pixel = pixels[i];
            ctx.fillRect(pixel.x, pixel.y, 1, 1);
          }
        }
      }
      
      // Draw star head
      const headAlpha = currentAlpha * headFadeFactor;
      if (headAlpha > 0.05) {
        ctx.fillStyle = getCachedStyle(headAlpha);
        // Horizontal line
        ctx.fillRect(startX - 1, startY, 3, 1);
        // Vertical line
        ctx.fillRect(startX, startY - 1, 1, 3);
      }
    }
  }
  
  // Pre-calculate some values used in drawing
  const fadeStartY = canvasDisplayHeight * 0.1;
  const fadeEndY = canvasDisplayHeight * 0.99;
  const fadeRange = fadeEndY - fadeStartY;
  
  // Draw the stars on the canvas - optimized for performance
  function drawStars() {
    // Clear canvas - this is faster than fillRect
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Pre-compute values needed in the loop to avoid recalculation
    const starsLen = stars.length;
    
    // Use standard for loop instead of forEach (faster)
    for (let i = 0; i < starsLen; i++) {
      const star = stars[i];
      
      // Optimized inline fade factor calculation
      let fadeFactor = 1.0;
      if (star.y >= fadeStartY) {
        if (star.y > fadeEndY) {
          continue; // Skip fully faded stars
        }
        fadeFactor = 1.0 - ((star.y - fadeStartY) / fadeRange);
      }
      
      // Calculate and apply alpha
      const alpha = (0.4 + star.brightness * 0.6) * fadeFactor;
      
      // Only draw if visible
      if (alpha > 0.01) {
        star.type.draw(star.x, star.y, alpha);
      }
    }
    
    // Draw shooting stars on top
    drawShootingStars();
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
  
  // Update star properties for animation - optimized version
  function updateStars() {
    const now = Date.now();
    const timeMs = now % 10000; // Cycle every 10 seconds
    
    // Use standard for loop (faster than forEach)
    const starsLen = stars.length;
    for (let i = 0; i < starsLen; i++) {
      const star = stars[i];
      
      star.brightness += star.blinkDirection * star.blinkSpeed;
      
      // Clamp brightness to valid range
      if (star.brightness <= 0.2 || star.brightness >= 0.9) {
        star.blinkDirection *= -1;
        
        // Use a time-based probability instead of full random
        // This is cheaper and more consistent
        const flickerValue = (Math.sin(now * 0.001 + i * 0.1) + 1) * 0.5;
        if (flickerValue < 0.1) {
          star.brightness = 0.3 + (Math.sin(now * 0.001 + i) + 1) * 0.3;
          star.blinkSpeed = 0.01 + (Math.cos(now * 0.001 + i) + 1) * 0.01;
        }
      }
    }
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
  
  // Track whether we're in the viewport
  let isVisible = true;
  
  // Animation loop with optimizations
  function animate() {
    // Performance optimization: Only run full updates when tab is visible
    if (document.visibilityState === 'visible') {
      // Reset visibility if we were previously hidden
      if (!isVisible) {
        isVisible = true;
        console.log('Starfield animation resumed');
      }
      
      // Standard updates
      updateStars();
      updateShootingStars();
      drawStars();
    } else {
      // Reduce CPU usage when tab not visible
      if (isVisible) {
        isVisible = false;
        console.log('Starfield animation paused (tab inactive)');
      }
    }
    
    // Always request next frame
    requestAnimationFrame(animate);
  }
  
  // Listen for visibility changes to optimize performance
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      // Force a redraw when tab becomes visible again
      drawStars();
    }
  });
  
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
