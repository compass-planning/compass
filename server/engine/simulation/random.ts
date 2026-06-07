// ============================================================================
// RANDOM NUMBER GENERATION
// ============================================================================
// High-quality random number generators for Monte Carlo simulation
// Uses Box-Muller transform for normal distribution

// ── Box-Muller Transform ──────────────────────────────────────────────────
// Generates normally distributed random numbers from uniform distribution
// More accurate than approximation methods

let spare: number | null = null;

export function randomNormal(mean: number = 0, stdDev: number = 1): number {
  // Box-Muller transform generates pairs of normal random variables
  // We cache one and return the other to avoid wasting computation
  
  if (spare !== null) {
    const result = spare * stdDev + mean;
    spare = null;
    return result;
  }
  
  // Generate two uniform random numbers
  let u1: number, u2: number;
  do {
    u1 = Math.random();
    u2 = Math.random();
  } while (u1 === 0); // Avoid log(0)
  
  // Box-Muller transform
  const radius = Math.sqrt(-2.0 * Math.log(u1));
  const theta = 2.0 * Math.PI * u2;
  
  spare = radius * Math.sin(theta);
  return radius * Math.cos(theta) * stdDev + mean;
}

// ── Uniform Distribution ──────────────────────────────────────────────────

export function randomUniform(min: number = 0, max: number = 1): number {
  return min + (max - min) * Math.random();
}

// ── Exponential Distribution ──────────────────────────────────────────────

export function randomExponential(lambda: number): number {
  return -Math.log(1 - Math.random()) / lambda;
}

// ── Log-Normal Distribution ───────────────────────────────────────────────
// Useful for modeling asset prices (which can't be negative)

export function randomLogNormal(mu: number, sigma: number): number {
  const normal = randomNormal(mu, sigma);
  return Math.exp(normal);
}

// ── Seeded Random Number Generator ────────────────────────────────────────
// For reproducible simulations (testing)

export class SeededRandom {
  private seed: number;
  
  constructor(seed: number) {
    this.seed = seed;
  }
  
  // Simple Linear Congruential Generator
  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) % 2**32;
    return this.seed / 2**32;
  }
  
  normal(mean: number = 0, stdDev: number = 1): number {
    // Box-Muller with seeded random
    const u1 = this.next();
    const u2 = this.next();
    
    const radius = Math.sqrt(-2.0 * Math.log(u1));
    const theta = 2.0 * Math.PI * u2;
    
    return radius * Math.cos(theta) * stdDev + mean;
  }
}

// ── Random Selection from Array ───────────────────────────────────────────

export function randomChoice<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

// ── Random Sample (without replacement) ───────────────────────────────────

export function randomSample<T>(array: T[], n: number): T[] {
  if (n > array.length) {
    throw new Error(`Cannot sample ${n} items from array of length ${array.length}`);
  }
  
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  return shuffled.slice(0, n);
}

// ── Shuffle Array (Fisher-Yates) ──────────────────────────────────────────

export function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
