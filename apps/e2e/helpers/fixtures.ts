import { randomUUID } from "crypto";

export function generateTestOrgName() {
    return `E2E_org_${randomUUID().slice(0, 8)}`;
}

export function generateTestCollectionName() {
    return `E2E_col_${randomUUID().slice(0, 8)}`;
}

export function generateTestPaperTitle() {
    return `E2E_paper_${randomUUID().slice(0, 8)}`;
}
