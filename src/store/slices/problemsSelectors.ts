/**
 * Problems Selectors
 * Memoized selectors for problems state with filtering and search
 */

import { createSelector } from "@reduxjs/toolkit";
import Fuse from "fuse.js";
import type { RootState } from "../index";
import type { SystemDesignProblem } from "../../types/systemDesign";

// Base selectors
export const selectProblemsState = (state: RootState) => state.problems;
export const selectAllProblems = (state: RootState) => state.problems.problems;
export const selectProblemsLoading = (state: RootState) =>
  state.problems.loading;
export const selectProblemsLoadingMore = (state: RootState) =>
  state.problems.loadingMore;
export const selectProblemsHasMore = (state: RootState) =>
  state.problems.hasMore;
export const selectProblemsTotalCount = (state: RootState) =>
  state.problems.totalCount;
export const selectProblemsError = (state: RootState) => state.problems.error;
export const selectAttemptedProblems = (state: RootState) =>
  state.problems.attemptedProblems;

// Filter selectors
export const selectSelectedDifficulty = (state: RootState) =>
  state.problems.selectedDifficulty;
export const selectSelectedCategory = (state: RootState) =>
  state.problems.selectedCategory;
export const selectSelectedDomain = (state: RootState) =>
  state.problems.selectedDomain;
export const selectSearchQuery = (state: RootState) =>
  state.problems.searchQuery;

// Derived selectors
export const selectCategories = createSelector(
  [selectAllProblems],
  (problems) => {
    const categories = new Set(problems.map((p) => p.category));
    return ["All", ...Array.from(categories)];
  },
);

export const selectDomains = createSelector([selectAllProblems], (problems) => {
  const domains = new Set(problems.map((p) => p.domain));
  return ["All", ...Array.from(domains)];
});

export const selectDifficulties = () => [
  "All",
  "Easy",
  "Medium",
  "Hard",
  "Very Hard",
];

// Filtered and searched problems
export const selectFilteredProblems = createSelector(
  [
    selectAllProblems,
    selectSearchQuery,
    selectSelectedDifficulty,
    selectSelectedCategory,
    selectSelectedDomain,
    selectAttemptedProblems,
  ],
  (problems, searchQuery, difficulty, category, domain, attemptedProblems) => {
    let results = problems;

    // Apply search if query exists
    if (searchQuery.trim().length > 0) {
      const fuse = new Fuse(problems, {
        keys: [
          { name: "title", weight: 0.6 },
          { name: "description", weight: 0.25 },
          { name: "tags", weight: 0.15 },
        ],
        includeScore: true,
        threshold: 0.45,
      });

      results = fuse.search(searchQuery).map((r) => r.item);
    }

    // Apply filters
    const filtered = results.filter((problem: SystemDesignProblem) => {
      const matchesDifficulty =
        difficulty === "All" || problem.difficulty === difficulty;
      const matchesCategory =
        category === "All" || problem.category === category;
      const matchesDomain = domain === "All" || problem.domain === domain;
      return matchesDifficulty && matchesCategory && matchesDomain;
    });

    // Sort: attempted problems first, then by original order
    return filtered.sort((a, b) => {
      const aAttempted = attemptedProblems.has(a.id) ? 1 : 0;
      const bAttempted = attemptedProblems.has(b.id) ? 1 : 0;
      return bAttempted - aAttempted; // Attempted (1) comes before not attempted (0)
    });
  },
);

// Count selectors
export const selectProblemsCount = createSelector(
  [selectFilteredProblems],
  (problems) => problems.length,
);

export const selectAttemptedProblemsCount = createSelector(
  [selectAttemptedProblems],
  (attemptedProblems) => attemptedProblems.size,
);

// Check if a specific problem is attempted
export const selectIsProblemAttempted = (problemId: string) =>
  createSelector([selectAttemptedProblems], (attemptedProblems) =>
    attemptedProblems.has(problemId),
  );
