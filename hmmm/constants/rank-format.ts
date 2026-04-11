export function formatOrdinalRank(rank: number): string {
    const suffix = rank % 100 >= 11 && rank % 100 <= 13
        ? 'th'
        : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[rank % 10] ?? 'th';

    return `${rank}${suffix}`;
}