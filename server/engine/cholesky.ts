export interface CorrelationMatrix {
  size: number;
  data: number[][];
}

export interface AssetAssumptions {
  mean: number;
  volatility: number;
}

export interface CorrelatedReturns {
  equity: number;
  bond: number;
  inflation: number;
}

export const DEFAULT_CORRELATIONS: CorrelationMatrix = {
  size: 3,
  data: [
    [1.00, -0.15, 0.10],
    [-0.15, 1.00, 0.30],
    [0.10, 0.30, 1.00],
  ],
};

export function choleskyDecompose(matrix: CorrelationMatrix): number[][] {
  const n = matrix.size;
  if (n === 0) throw new Error("Matrix must have size > 0");
  if (matrix.data.length !== n) throw new Error("Matrix data rows must match size");
  for (let i = 0; i < n; i++) {
    if (matrix.data[i].length !== n) throw new Error(`Row ${i} length must match matrix size`);
    if (matrix.data[i][i] <= 0) throw new Error(`Diagonal element at index ${i} must be strictly positive`);
    for (let j = 0; j < n; j++) {
      if (Math.abs(matrix.data[i][j] - matrix.data[j][i]) > 1e-10) {
        throw new Error(`Matrix is not symmetric at (${i},${j})`);
      }
    }
  }
  const L: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) {
        sum += L[i][k] * L[j][k];
      }
      if (i === j) {
        const diag = matrix.data[i][i] - sum;
        if (diag <= 0) {
          throw new Error(`Matrix is not positive definite at index ${i}`);
        }
        L[i][j] = Math.sqrt(diag);
      } else {
        if (L[j][j] === 0) {
          throw new Error(`Zero diagonal element at index ${j}`);
        }
        L[i][j] = (matrix.data[i][j] - sum) / L[j][j];
      }
    }
  }

  return L;
}

function boxMullerNormal(rng: () => number): number {
  let u1: number;
  let u2: number;
  do {
    u1 = rng();
  } while (u1 === 0);
  u2 = rng();
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
}

export function generateCorrelatedNormals(
  L: number[][],
  rng: () => number
): number[] {
  const n = L.length;
  const z: number[] = [];
  for (let i = 0; i < n; i++) {
    z.push(boxMullerNormal(rng));
  }

  const correlated: number[] = Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      correlated[i] += L[i][j] * z[j];
    }
  }

  return correlated;
}

export function logNormalReturn(mean: number, volatility: number, normalDraw: number): number {
  const mu = Math.log(1 + mean) - 0.5 * volatility * volatility;
  return Math.exp(mu + volatility * normalDraw) - 1;
}

export function generateCorrelatedReturns(
  L: number[][],
  assumptions: {
    equity: AssetAssumptions;
    bond: AssetAssumptions;
    inflation: AssetAssumptions;
  },
  rng: () => number
): CorrelatedReturns {
  const normals = generateCorrelatedNormals(L, rng);

  return {
    equity: logNormalReturn(assumptions.equity.mean, assumptions.equity.volatility, normals[0]),
    bond: logNormalReturn(assumptions.bond.mean, assumptions.bond.volatility, normals[1]),
    inflation: logNormalReturn(assumptions.inflation.mean, assumptions.inflation.volatility, normals[2]),
  };
}

export function createSeededRng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) & 0xffffffff;
    return (state >>> 0) / 0x100000000;
  };
}
