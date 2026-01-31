/**
 * Fuzzy matching configuration parameters.
 * These control how job names are matched against queries.
 */

/** Minimum score threshold (0-100) for a match to be considered valid. */
export const MIN_SCORE = 30;

/**
 * Score gap threshold for determining if top matches are ambiguous.
 * If the gap between top score and other matches is within this value,
 * they are considered ambiguous and user will be prompted to choose.
 */
export const AMBIGUITY_GAP = 8;

/** Maximum number of options to show when there are ambiguous matches. */
export const MAX_OPTIONS = 10;

/**
 * Score constants for different match types.
 * Higher scores indicate better matches.
 */
export const SCORES = {
  /** Perfect exact match of the entire job name */
  EXACT: 100,

  /** Query matches the beginning of job name */
  PREFIX: 80,

  /** Query appears anywhere within job name */
  SUBSTRING: 60,

  /** Base score for token overlap (calculated as ratio * 40) */
  TOKEN_OVERLAP_BASE: 40,
} as const;
