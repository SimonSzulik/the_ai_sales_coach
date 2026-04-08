"""Deterministic financing calculator — cash, partial, full scenarios."""

from __future__ import annotations

from app.models import FinancingScenario, Offer

DEFAULT_INTEREST_RATE = 0.0399  # 3.99% — realistic KfW promotional rate
DEFAULT_TERM_YEARS = 15


def compute_financing(
    offer: Offer,
    subsidy_total_eur: float = 0.0,
    interest_rate: float = DEFAULT_INTEREST_RATE,
    term_years: int = DEFAULT_TERM_YEARS,
) -> list[FinancingScenario]:
    capex = offer.capex_eur
    net_capex = max(0, capex - subsidy_total_eur)

    return [
        _cash(net_capex, subsidy_total_eur),
        _partial(net_capex, subsidy_total_eur, interest_rate, term_years),
        _full(net_capex, subsidy_total_eur, interest_rate, term_years),
    ]


def _cash(net_capex: float, subsidy: float) -> FinancingScenario:
    return FinancingScenario(
        type="cash",
        down_payment_eur=round(net_capex, 2),
        loan_principal_eur=0,
        interest_rate_pct=0,
        term_years=0,
        monthly_payment_eur=0,
        total_cost_eur=round(net_capex, 2),
        subsidy_deducted_eur=round(subsidy, 2),
    )


def _partial(net_capex: float, subsidy: float, rate: float, years: int) -> FinancingScenario:
    down = net_capex * 0.30
    principal = net_capex - down
    monthly = _annuity(principal, rate, years)
    total = down + monthly * 12 * years

    return FinancingScenario(
        type="partial",
        down_payment_eur=round(down, 2),
        loan_principal_eur=round(principal, 2),
        interest_rate_pct=round(rate * 100, 2),
        term_years=years,
        monthly_payment_eur=round(monthly, 2),
        total_cost_eur=round(total, 2),
        subsidy_deducted_eur=round(subsidy, 2),
    )


def _full(net_capex: float, subsidy: float, rate: float, years: int) -> FinancingScenario:
    monthly = _annuity(net_capex, rate, years)
    total = monthly * 12 * years

    return FinancingScenario(
        type="full",
        down_payment_eur=0,
        loan_principal_eur=round(net_capex, 2),
        interest_rate_pct=round(rate * 100, 2),
        term_years=years,
        monthly_payment_eur=round(monthly, 2),
        total_cost_eur=round(total, 2),
        subsidy_deducted_eur=round(subsidy, 2),
    )


def _annuity(principal: float, annual_rate: float, years: int) -> float:
    if principal <= 0 or years <= 0:
        return 0.0
    if annual_rate <= 0:
        return principal / (years * 12)
    r = annual_rate / 12
    n = years * 12
    return principal * r * (1 + r) ** n / ((1 + r) ** n - 1)
