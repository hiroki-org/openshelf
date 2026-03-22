const inviteRows = Array.from({ length: 10000 }).map((_, i) => ({
    id: `invite-${i}`,
    paperId: 'paper-1',
    inviterId: 'user-1',
    inviteeId: i % 2 === 0 ? `user-${i % 100}` : null,
    inviteeEmail: null,
}));

function original() {
    return [
        ...new Set(
            inviteRows
                .map((inv) => inv.inviteeId)
                .filter((v): v is string => typeof v === "string"),
        ),
    ];
}

function optimized() {
    const inviteeIdsSet = new Set<string>();
    for (const inv of inviteRows) {
        if (typeof inv.inviteeId === "string") {
            inviteeIdsSet.add(inv.inviteeId);
        }
    }
    return Array.from(inviteeIdsSet);
}

function optimizedReduce() {
    return Array.from(
        inviteRows.reduce((acc, inv) => {
            if (typeof inv.inviteeId === "string") {
                acc.add(inv.inviteeId);
            }
            return acc;
        }, new Set<string>())
    );
}

const N = 10000;

console.time("original");
for (let i = 0; i < N; i++) {
    original();
}
console.timeEnd("original");

console.time("optimized (for...of)");
for (let i = 0; i < N; i++) {
    optimized();
}
console.timeEnd("optimized (for...of)");

console.time("optimized (reduce)");
for (let i = 0; i < N; i++) {
    optimizedReduce();
}
console.timeEnd("optimized (reduce)");
