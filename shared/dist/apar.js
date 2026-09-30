import { dec } from './decimal.js';
import { GRAMS_PER_BAHT } from './constants.js';
/**
 * Resolve a movement to its posting rule. Returns null when the partner is
 * not tracked for AP/AR (a cabinet or a wholesale customer), which is a
 * normal outcome, not an error.
 */
export function findPostingRule(rules, scope, type, partnerCode) {
    return (rules.find((r) => r.scope === scope && r.type === type && r.partnerCode === partnerCode) ?? null);
}
/**
 * Turn a movement into the IN/OUT columns of the AP/AR (GOLD) ledger.
 *
 * A `sign` of +1 books the weight in the ledger's IN column (increasing the
 * obligation) and -1 books it in OUT (settling it), which keeps the §8.2
 * running-total formula identical to the stock ledgers.
 */
export function buildGoldPosting(rule, weightG, cost) {
    const w = dec(weightG);
    const c = dec(cost);
    const increases = rule.sign === 1;
    return {
        side: rule.side,
        goldInG: increases ? w : dec(0),
        goldOutG: increases ? dec(0) : w,
        priceIn: increases ? c : dec(0),
        priceOut: increases ? dec(0) : c,
    };
}
/**
 * AR_Total = AR_Start + AR_Net_Movement (and the same for AP) — TOR §8.1.
 */
export function summariseGoldApAr(startG, increasesG, decreasesG) {
    const netMovementG = dec(increasesG).minus(dec(decreasesG));
    const totalG = dec(startG).plus(netMovementG);
    return {
        startG: dec(startG),
        netMovementG,
        totalG,
        totalBaht: totalG.div(GRAMS_PER_BAHT),
    };
}
/**
 * ຍອດປັດຈຸບັນ = ຍອດຍົກມາ + AP(GOLD)(+) − AP(GOLD)(-)  — TOR §8.2, per partner.
 */
export function partnerBalance(broughtForwardG, increasesG, decreasesG) {
    return dec(broughtForwardG).plus(dec(increasesG)).minus(dec(decreasesG));
}
/**
 * The §9.2 posting table, expressed once so no caller has to remember which
 * way round a given event goes:
 *
 *   Stock IN ມີຄ່າແຮງຊ່າງ            -> +AP  (ຕິດໜີ້ຄ່າແຮງຊ່າງ)
 *   payment ຈ່າຍຄ່າແຮງຊ່າງ           -> −AP  (ຊຳຣະໜີ້ຄ່າແຮງແລ້ວ)
 *   ຍອດສິນເຊື່ອໃໝ່                   -> +AR
 *   ຮັບຄ່າງວດສິນເຊື່ອ                 -> −AR
 *   ລາຍການ AP/AR ທີ່ເພີ່ມດ້ວຍມື       -> MANUAL_AP / MANUAL_AR
 *
 * Order deposits are NOT here. §9.2 of the updated TOR scopes AP (Cash) to
 * ຄ່າແຮງຊ່າງຄ້າງຈ່າຍ alone, and routes customer advances to their own
 * Advance ledger (§7) instead — see `netAdvance` and `cashOnHand`.
 */
const CASH_POSTING_TABLE = {
    LABOR_PAYABLE: { side: 'AP', sign: 1 },
    LABOR_PAYMENT: { side: 'AP', sign: -1 },
    CREDIT_ISSUED: { side: 'AR', sign: 1 },
    CREDIT_RECEIPT: { side: 'AR', sign: -1 },
    MANUAL_AP: { side: 'AP', sign: 1 },
    MANUAL_AP_PAYMENT: { side: 'AP', sign: -1 },
    MANUAL_AR: { side: 'AR', sign: 1 },
    MANUAL_AR_RECEIPT: { side: 'AR', sign: -1 },
    ADJUSTMENT: { side: 'AP', sign: 1 },
};
export function buildCashPosting(reason, currency, amount, 
/** Overrides the table for ADJUSTMENT, which can go either way. */
override) {
    const rule = override ?? CASH_POSTING_TABLE[reason];
    const value = dec(amount);
    const increases = rule.sign === 1;
    return {
        side: rule.side,
        reason,
        currency,
        amountIn: increases ? value : dec(0),
        amountOut: increases ? dec(0) : value,
    };
}
/**
 * AP Net = AP ຍອດຕັ້ງຕົ້ນ + AP(+) − AP(-)   (TOR §9.2)
 * AR Net = AR ຍອດຕັ້ງຕົ້ນ + AR(+) − AR(-)
 */
export function netCashApAr(opening, increases, decreases) {
    return {
        opening: dec(opening),
        increases: dec(increases),
        decreases: dec(decreases),
        net: dec(opening).plus(dec(increases)).minus(dec(decreases)),
    };
}
/**
 * Rollover Rule (TOR §9.2): ເມື່ອສິ້ນສຸດມື້ ຍອດສຸດທິທ້າຍມື້ຈະຖືກຍົກໄປເປັນ
 * ຍອດຕັ້ງຕົ້ນ ຂອງມື້ທັດໄປອັດໂນມັດ.
 *
 * Trivial by itself, but naming it keeps the day-close job honest: the
 * opening of day N+1 is defined as the closing of day N and nothing else.
 */
export function rollover(closingNet) {
    return dec(closingNet);
}
/**
 * COH Cash = Cash + BCEL + LDB + Other Bank − AP + AR − Advance
 * (per currency, TOR §3.7).
 */
export function cashOnHand(input) {
    return dec(input.cash)
        .plus(dec(input.bcel))
        .plus(dec(input.ldb))
        .plus(dec(input.otherBank))
        .minus(dec(input.ap))
        .plus(dec(input.ar))
        .minus(dec(input.advance ?? 0));
}
/**
 * ຍອດ Advance ສຸດທິ = ຍອດຮັບລ່ວງໜ້າ − ຍອດທີ່ຕັດຊຳຣະແລ້ວ (TOR §7).
 *
 * Named rather than inlined so the Advance dashboard, COH and the Order
 * settlement all agree on what "outstanding advance" means.
 */
export function netAdvance(increases, decreases) {
    return dec(increases).minus(dec(decreases));
}
/** COH Gold = Gold NEW(g) + Gold OLD(g) − AP + AR. */
export function goldOnHand(input) {
    const weightG = dec(input.newG)
        .plus(dec(input.oldG))
        .minus(dec(input.apG))
        .plus(dec(input.arG));
    return { weightG, baht: weightG.div(GRAMS_PER_BAHT) };
}
/**
 * TOR §3.7 Module Wealth — total holdings expressed in LAK and then as the
 * weight of gold they would buy at today's price.
 */
export function calculateWealth(input) {
    const totalLak = dec(input.totalLak)
        .plus(dec(input.totalThb).mul(dec(input.thbSellRate)))
        .plus(dec(input.totalUsd).mul(dec(input.usdSellRate)));
    const price1Baht = dec(input.price1Baht);
    const baht = price1Baht.isZero() ? dec(0) : totalLak.div(price1Baht);
    return { totalLak, weightG: baht.mul(GRAMS_PER_BAHT), baht };
}
/**
 * TOR §4.3 averages.
 *
 *   ຄຳດີ / ຫຍຸບ / ແທ່ງ : ສະເລ່ຍ(g) = ລວມເງິນທີ່ຕ້ອງຈ່າຍ / (ລວມນ້ຳໜັກຄຳເກົ່າ − ລວມນ້ຳໜັກຄຳໃໝ່)
 *   ຄຳຕົ້ມ            : ສະເລ່ຍ(g) = ລວມເງິນທີ່ຕ້ອງຈ່າຍ / ລວມນ້ຳໜັກຄຳເກົ່າ
 *   ສະເລ່ຍ ບາດ        = ສະເລ່ຍ(g) × 15
 *
 * TODO(TOR-6): for the first formula the divisor is zero whenever an exchange
 * balances — which §5.2 REQUIRES it to — and negative when more new gold goes
 * out than old gold comes in. Rather than emit Infinity or a negative average
 * into a financial report, this returns null with a Lao explanation for the
 * UI to render as "—". Confirm the intended divisor with the shop.
 */
export function goldTypeAverage(totalPaid, totalOldWeightG, totalNewWeightG, isBoiled = false) {
    const divisor = isBoiled
        ? dec(totalOldWeightG)
        : dec(totalOldWeightG).minus(dec(totalNewWeightG));
    if (divisor.isZero()) {
        return {
            perGram: null,
            perBaht: null,
            messageLo: 'ຄິດໄລ່ສະເລ່ຍບໍ່ໄດ້ — ນ້ຳໜັກຄຳເກົ່າ ແລະ ຄຳໃໝ່ ເທົ່າກັນ',
        };
    }
    if (divisor.isNegative()) {
        return {
            perGram: null,
            perBaht: null,
            messageLo: 'ຄິດໄລ່ສະເລ່ຍບໍ່ໄດ້ — ນ້ຳໜັກຄຳໃໝ່ຫຼາຍກວ່າຄຳເກົ່າ',
        };
    }
    const perGram = dec(totalPaid).div(divisor);
    return { perGram, perBaht: perGram.mul(GRAMS_PER_BAHT), messageLo: null };
}
//# sourceMappingURL=apar.js.map