// ============================================================================
// MATRIX OPERATIONS
// ============================================================================
// Numerical linear algebra operations for Monte Carlo simulation
// Key function: Cholesky decomposition for generating correlated random variables

// ── Cholesky Decomposition ─────────────────────────────────────────────────
// Decomposes a symmetric positive-definite matrix A into L * L^T
// Where L is a lower triangular matrix
//
// Used to transform independent random variables into correlated ones:
// If Z = [z1, z2, ..., zn] are independent N(0,1) variables,
// then X = L*Z has covariance matrix equal to the original correlation matrix

export function choleskyDecomposition(matrix: number[][]): number[][] {
  const n = matrix.length;
  
  // Validate square matrix
  if (!matrix.every(row => row.length === n)) {
    throw new Error("Matrix must be square for Cholesky decomposition");
  }
  
  // Initialize L matrix (lower triangular)
  const L: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));
  
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      
      if (j === i) {
        // Diagonal elements
        for (let k = 0; k < j; k++) {
          sum += L[j][k] * L[j][k];
        }
        const value = matrix[j][j] - sum;
        
        if (value < -1e-10) {
          throw new Error(
            `Matrix is not positive definite at position [${j},${j}]: ${value}`
          );
        }
        
        L[j][j] = Math.sqrt(Math.max(0, value));
      } else {
        // Off-diagonal elements
        for (let k = 0; k < j; k++) {
          sum += L[i][k] * L[j][k];
        }
        
        if (Math.abs(L[j][j]) < 1e-10) {
          L[i][j] = 0;
        } else {
          L[i][j] = (matrix[i][j] - sum) / L[j][j];
        }
      }
    }
  }
  
  return L;
}

// ── Matrix-Vector Multiplication ──────────────────────────────────────────
// Multiplies matrix A by vector v
// Returns resulting vector

export function matrixMultiply(A: number[][], v: number[]): number[] {
  const m = A.length;
  const n = v.length;
  
  if (A[0].length !== n) {
    throw new Error(
      `Matrix columns (${A[0].length}) must match vector length (${n})`
    );
  }
  
  const result: number[] = Array(m).fill(0);
  
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      result[i] += A[i][j] * v[j];
    }
  }
  
  return result;
}

// ── Matrix Transpose ───────────────────────────────────────────────────────

export function transpose(matrix: number[][]): number[][] {
  const rows = matrix.length;
  const cols = matrix[0].length;
  
  const result: number[][] = Array(cols).fill(0).map(() => Array(rows).fill(0));
  
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      result[j][i] = matrix[i][j];
    }
  }
  
  return result;
}

// ── Matrix Multiplication (Matrix × Matrix) ────────────────────────────────

export function matrixMatrixMultiply(A: number[][], B: number[][]): number[][] {
  const m = A.length;
  const n = A[0].length;
  const p = B[0].length;
  
  if (B.length !== n) {
    throw new Error(
      `Matrix A columns (${n}) must match Matrix B rows (${B.length})`
    );
  }
  
  const result: number[][] = Array(m).fill(0).map(() => Array(p).fill(0));
  
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < p; j++) {
      for (let k = 0; k < n; k++) {
        result[i][j] += A[i][k] * B[k][j];
      }
    }
  }
  
  return result;
}

// ── Verify Cholesky Decomposition ─────────────────────────────────────────
// Reconstructs original matrix from L and verifies accuracy
// Used for testing/debugging

export function verifyCholesky(L: number[][], original: number[][]): boolean {
  const LT = transpose(L);
  const reconstructed = matrixMatrixMultiply(L, LT);
  
  const n = original.length;
  const tolerance = 1e-6;
  
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (Math.abs(reconstructed[i][j] - original[i][j]) > tolerance) {
        console.error(
          `Mismatch at [${i},${j}]: ` +
          `expected ${original[i][j]}, got ${reconstructed[i][j]}`
        );
        return false;
      }
    }
  }
  
  return true;
}

// ── Covariance Matrix from Correlation ─────────────────────────────────────
// Converts correlation matrix and volatilities to covariance matrix

export function correlationToCovariance(
  correlation: number[][],
  volatilities: number[]
): number[][] {
  const n = correlation.length;
  const covariance: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));
  
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      covariance[i][j] = correlation[i][j] * volatilities[i] * volatilities[j];
    }
  }
  
  return covariance;
}
