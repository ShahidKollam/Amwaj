import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
    Search,
    Plus,
    Minus,
    Trash2,
    UserPlus,
    ChevronUp,
    ChevronDown,
    ChevronRight,
    Check,
    Banknote,
    Smartphone,
    ArrowLeft,
    X,
    Droplet,
    Package,
    SprayCan,
    Flame,
    Box,
} from 'lucide-react'
import { api, formatINR } from '../services/api'
import { useAuth } from '../context/AuthContext'
import Modal, { ConfirmModal } from '../components/Modal'
import { useProducts, useCategories } from '../hooks/useCatalog'
import { useCartStore } from '../store/cartStore'
import { completeBillSafe } from '../lib/billSync'
import { getWhatsAppShareUrl } from '../utils/whatsapp'

const CATEGORY_ICON = {
    Attar: Droplet,
    Oud: Package,
    Spray: SprayCan,
    Bakhoor: Flame,
    Accessories: Box,
}

function toPaise(rupees) {
    return Math.round(Number(rupees) * 100)
}
function fromPaise(paise) {
    return (paise || 0) / 100
}

const SPRAY_SIZES = [10, 20, 30, 40, 50, 100]

/** Spray bill: oil ml × oil rate + water ml × water rate + bottle (if included) */
function calcSprayLinePaise({ bottleMl, ratio, oilRatePaise, waterRatePaise, bottlePricePaise, includeBottle }) {
    const ml = Number(bottleMl) || 0
    const r = Math.min(100, Math.max(0, Number(ratio) || 0))
    const oilMl = ml > 0 ? Math.round(((ml * r) / 100) * 1000) / 1000 : 0
    const waterMl = ml > 0 ? Math.round((ml - oilMl) * 1000) / 1000 : 0
    const oilP = Math.max(0, Number(oilRatePaise) || 0)
    const waterP = Math.max(0, Number(waterRatePaise) || 0)
    const bottleP = Math.max(0, Number(bottlePricePaise) || 0)
    const include = includeBottle !== false
    const total = Math.round(oilMl * oilP + waterMl * waterP + (include ? bottleP : 0))
    return { oilMl, waterMl, unitPricePaise: Math.max(0, total) }
}


export default function BillPage() {
    const { user } = useAuth()
    const [categories, setCategories] = useState([])
    const [products, setProducts] = useState([])
    const [activeCategory, setActiveCategory] = useState(null)
    const [search, setSearch] = useState('')
    const [cart, setCart] = useState([])
    const [customer, setCustomer] = useState(null)
    const [additional, setAdditional] = useState(0)
    const [discount, setDiscount] = useState(0)
    const [cash, setCash] = useState('')
    const [sizePickProduct, setSizePickProduct] = useState(null) // SPRAY size sheet
    const [upi, setUpi] = useState('')
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [completedInvoice, setCompletedInvoice] = useState(null)
    const [showCustomerModal, setShowCustomerModal] = useState(false)
    const [confirmClear, setConfirmClear] = useState(false)
    const [errorMsg, setErrorMsg] = useState('')
    // Mobile flow: browse | review
    const [view, setView] = useState('browse')
    const [billExpanded, setBillExpanded] = useState(false)
    const cartHydrated = useRef(false)

    // Catalog from TanStack Query + IndexedDB (instant cache, background refresh)
    const productsQuery = useProducts()
    const categoriesQuery = useCategories()

    useEffect(() => {
        const prods = (Array.isArray(productsQuery.data) ? productsQuery.data : []).filter((p) => p?.isActive !== false)
        const cats = Array.isArray(categoriesQuery.data) ? categoriesQuery.data : []
        if (prods.length) setProducts(prods)
        else if (!productsQuery.isLoading && productsQuery.isFetched) setProducts([])
        if (cats.length) {
            setCategories(cats)
            setActiveCategory((prev) => {
                if (prev && cats.some((c) => c.id === prev)) return prev
                return cats[0]?.id || null
            })
        }
        if (!productsQuery.isLoading && !categoriesQuery.isLoading) setLoading(false)
        if (prods.length || cats.length) setLoading(false)
    }, [
        productsQuery.data,
        categoriesQuery.data,
        productsQuery.isLoading,
        categoriesQuery.isLoading,
        productsQuery.isFetched,
    ])

    // While size sheet open, keep the spray product rates in sync with latest catalog
    useEffect(() => {
        if (!sizePickProduct?.id) return
        const list = Array.isArray(productsQuery.data) ? productsQuery.data : []
        const fresh = list.find((p) => p.id === sizePickProduct.id)
        if (fresh) setSizePickProduct(fresh)
    }, [productsQuery.data, sizePickProduct?.id])

    // Restore unfinished bill from IndexedDB once
    useEffect(() => {
        const unsub = useCartStore.subscribe(() => {})
        const tryHydrate = () => {
            const s = useCartStore.getState()
            if (!s.hydrated || cartHydrated.current) return
            cartHydrated.current = true
            if (s.items && s.items.length) {
                setCart(s.items)
                setCustomer(s.customer)
                setAdditional(s.additional || 0)
                setDiscount(s.discount || 0)
                setCash(s.cash || '')
                setUpi(s.upi || '')
            }
        }
        tryHydrate()
        const id = setInterval(() => {
            if (useCartStore.getState().hydrated) {
                tryHydrate()
                clearInterval(id)
            }
        }, 50)
        return () => {
            clearInterval(id)
            unsub()
        }
    }, [])

    // Persist cart changes to IndexedDB
    useEffect(() => {
        if (!cartHydrated.current && cart.length === 0) return
        useCartStore.getState().replaceCart({
            items: cart,
            customer,
            additional,
            discount,
            cash,
            upi,
        })
    }, [cart, customer, additional, discount, cash, upi])

    // Expanded spray groups on the bill browser
    const [expandedGroups, setExpandedGroups] = useState(() => new Set())

    const toggleGroup = (id) => {
        setExpandedGroups((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    /**
     * Catalog rows for bill UI:
     * - Standalone sellable products (attar/oud/bakhoor/…) as before
     * - Spray groups as parent headings; children are billable sizes
     * Search is case-insensitive; matches parent or child name / size
     */
    const catalogRows = useMemo(() => {
        let list = Array.isArray(products) ? products : []
        if (activeCategory) list = list.filter((p) => p?.categoryId === activeCategory)

        const q = search.trim().toLowerCase()
        const matches = (p) => {
            if (!q) return true
            return (p?.name || '').toLowerCase().includes(q)
        }

        // Flat catalog: attar/oud/spray/bakhoor as same 2-col cards.
        // Hide group parents and size-children (legacy); sprays are standalone.
        const standalone = list.filter((p) => !p.isGroup && !p.parentId)

        const rank = (p) => (p.productType === 'SPRAY' ? 1 : 0)
        return standalone
            .filter(matches)
            .sort(
                (a, b) =>
                    rank(a) - rank(b) ||
                    (a.sortOrder || 0) - (b.sortOrder || 0) ||
                    (a.name || '').localeCompare(b.name || '')
            )
            .map((p) => ({ type: 'product', product: p }))
    }, [products, activeCategory, search])


    const filteredProducts = catalogRows // kept name for minimal churn in empty-state checks

    /** Bill items list: non-spray first, sprays at the bottom */
    const sortedCart = useMemo(() => {
        const list = Array.isArray(cart) ? [...cart] : []
        return list.sort((a, b) => {
            const ra = a.productType === 'SPRAY' ? 1 : 0
            const rb = b.productType === 'SPRAY' ? 1 : 0
            return ra - rb
        })
    }, [cart])


    const subtotalPaise = useMemo(
        () => (Array.isArray(cart) ? cart : []).reduce((s, item) => s + (item?.lineTotalPaise || 0), 0),
        [cart]
    )
    const additionalPaise = toPaise(additional)
    const discountPaise = toPaise(discount)
    const totalPaise = Math.max(0, subtotalPaise + additionalPaise - discountPaise)

    // Default payment: UPI full when cart total changes and fields are empty
    useEffect(() => {
        if (totalPaise <= 0) return
        const c = toPaise(cash || 0)
        const u = toPaise(upi || 0)
        if (c === 0 && u === 0) {
            setUpi(fromPaise(totalPaise).toString())
            setCash('')
        }
    }, [totalPaise])

    const cashSelected = toPaise(cash || 0) > 0
    const upiSelected = toPaise(upi || 0) > 0
    const cashIsFull =
        cashSelected && toPaise(upi || 0) === 0 && toPaise(cash || 0) === totalPaise && totalPaise > 0
    const upiIsFull =
        upiSelected && toPaise(cash || 0) === 0 && toPaise(upi || 0) === totalPaise && totalPaise > 0

    const addProduct = (product) => {
        // Parent groups are headings only — never billable
        if (!product || product.isGroup) return
        // Flat spray: pick bottle size first (same card grid, not full-width expand)
        if (product.productType === 'SPRAY' && !product.bottleSizeMl) {
            // Always refetch catalog so edited oil/water/bottle prices apply
            Promise.resolve(productsQuery.refetch?.())
                .catch(() => {})
                .finally(() => setSizePickProduct(product))
            return
        }

        // Same product again → increase qty on existing line (no duplicate lines)
        // PER_ML (attar/oud): +3 ml each tap → 3, 6, 9, 12…
        // SPRAY same size: +1 bottle; FIXED: +1
        setCart((prev) => {
            const existing = prev.find((i) => {
                if (i.productId !== product.id) return false
                if (product.productType === 'SPRAY') {
                    return (i.sprayBottleMl || null) === (product.bottleSizeMl || null)
                }
                return true
            })
            if (existing) {
                const step = product.productType === 'PER_ML' ? 3 : 1
                const qty = existing.quantity + step
                const lineTotal = Math.round(qty * existing.unitPricePaise) - (existing.discountPaise || 0)
                return prev.map((i) =>
                    i.key === existing.key ? { ...i, quantity: qty, lineTotalPaise: Math.max(0, lineTotal) } : i
                )
            }
            if (product.productType === 'PER_ML') {
                const qty = 3
                return [
                    ...prev,
                    {
                        key: `${product.id}-${Date.now()}`,
                        productId: product.id,
                        productName: product.name,
                        productType: product.productType,
                        unit: product.unit,
                        quantity: qty,
                        unitPricePaise: product.unitPrice,
                        lineTotalPaise: Math.round(qty * product.unitPrice),
                        discountPaise: 0,
                    },
                ]
            }
            if (product.productType === 'SPRAY') {
                const bottleMl = product.bottleSizeMl || null
                const ratio = 50 // default 50% oil / 50% water; editable on bill
                const list = Array.isArray(products) ? products : []

                // Oil rate (paise/ml): linked oil product, or spray unitPrice as oil rate
                let oilRatePaise = product.oilProduct?.unitPrice
                    ? Number(product.oilProduct.unitPrice)
                    : 0
                if (!oilRatePaise && product.oilProductId) {
                    const oil = list.find((x) => x.id === product.oilProductId)
                    if (oil?.unitPrice) oilRatePaise = Number(oil.unitPrice)
                }
                if (!oilRatePaise) oilRatePaise = Number(product.unitPrice) || 0

                // Water rate (paise/ml): linked water or catalog "Spray Water"
                let waterRatePaise = product.waterProduct?.unitPrice
                    ? Number(product.waterProduct.unitPrice)
                    : 0
                if (!waterRatePaise && product.waterProductId) {
                    const w = list.find((x) => x.id === product.waterProductId)
                    if (w?.unitPrice) waterRatePaise = Number(w.unitPrice)
                }
                if (!waterRatePaise) {
                    const waterSku = list.find(
                        (x) =>
                            !x.isGroup &&
                            (x.name || '').toLowerCase().includes('spray water')
                    )
                    if (waterSku?.unitPrice) waterRatePaise = Number(waterSku.unitPrice)
                }

                let bottlePricePaise = product.bottleProduct?.unitPrice
                    ? Number(product.bottleProduct.unitPrice)
                    : 0
                if (!bottlePricePaise && bottleMl) {
                    const bottleSku = list.find(
                        (x) =>
                            x.productType === 'FIXED' &&
                            !x.isGroup &&
                            Number(x.bottleSizeMl) === Number(bottleMl)
                    )
                    if (bottleSku?.unitPrice) bottlePricePaise = Number(bottleSku.unitPrice)
                }

                const calc = calcSprayLinePaise({
                    bottleMl,
                    ratio,
                    oilRatePaise,
                    waterRatePaise,
                    bottlePricePaise,
                    includeBottle: true,
                })
                const fullPrice = calc.unitPricePaise
                const displayName =
                    bottleMl != null ? `${product.name} · ${bottleMl} ml` : product.name
                return [
                    ...prev,
                    {
                        key: `${product.id}-${bottleMl || 'x'}-${Date.now()}`,
                        productId: product.id,
                        productName: displayName,
                        productType: 'SPRAY',
                        unit: product.unit || 'piece',
                        quantity: 1,
                        unitPricePaise: fullPrice,
                        lineTotalPaise: fullPrice,
                        discountPaise: 0,
                        sprayBottleMl: bottleMl,
                        sprayOilMl: calc.oilMl,
                        oilRatioPercent: ratio,
                        sprayIncludeBottle: true,
                        bottlePricePaise,
                        oilRatePaise,
                        waterRatePaise,
                        fullUnitPricePaise: fullPrice,
                    },
                ]
            }
            return [
                ...prev,
                {
                    key: `${product.id}-${Date.now()}`,
                    productId: product.id,
                    productName: product.name,
                    productType: product.productType,
                    unit: product.unit,
                    quantity: 1,
                    unitPricePaise: product.unitPrice,
                    lineTotalPaise: product.unitPrice,
                    discountPaise: 0,
                },
            ]
        })
    }

    const updateQty = (key, delta) => {
        setCart((prev) =>
            prev
                .map((item) => {
                    if (item.key !== key) return item
                    const base = typeof item.quantity === 'number' ? item.quantity : parseFloat(item.quantity) || 0
                    let qty = base + delta
                    if (item.productType === 'PER_ML') {
                        qty = Math.max(0, Math.round(qty * 2) / 2)
                    } else {
                        qty = Math.max(0, Math.round(qty))
                    }
                    if (qty <= 0) return null
                    const lineTotal = Math.round(qty * item.unitPricePaise) - (item.discountPaise || 0)
                    return { ...item, quantity: qty, lineTotalPaise: Math.max(0, lineTotal) }
                })
                .filter(Boolean)
        )
    }

    const setItemQty = (key, value) => {
        // Allow empty while typing (backspace on last digit); commit only valid numbers
        if (value === '' || value === null || value === undefined) {
            setCart((prev) =>
                prev.map((item) =>
                    item.key === key
                        ? { ...item, quantity: '', lineTotalPaise: 0 }
                        : item
                )
            )
            return
        }
        const num = parseFloat(value)
        if (isNaN(num)) return
        setCart((prev) =>
            prev
                .map((item) => {
                    if (item.key !== key) return item
                    if (num <= 0) return null
                    const qty = item.productType === 'PER_ML' ? num : Math.round(num)
                    const lineTotal = Math.round(qty * item.unitPricePaise) - (item.discountPaise || 0)
                    return { ...item, quantity: qty, lineTotalPaise: Math.max(0, lineTotal) }
                })
                .filter(Boolean)
        )
    }

    const addSpraySize = (product, ml) => {
        setSizePickProduct(null)
        addProduct({ ...product, bottleSizeMl: ml })
    }

    const removeItem = (key) => {

        setCart((prev) => prev.filter((i) => i.key !== key))
    }

    /** Owner: oil % + bottle ON/OFF recalculate line total immediately */
    const updateSprayItem = (key, patch) => {
        setCart((prev) =>
            prev.map((item) => {
                if (item.key !== key || item.productType !== 'SPRAY') return item
                const next = { ...item, ...patch }
                const bottleMl = next.sprayBottleMl || 0
                const ratio = Math.min(100, Math.max(0, Number(next.oilRatioPercent) || 0))
                next.oilRatioPercent = ratio
                next.sprayOilMl =
                    bottleMl > 0 ? Math.round(((bottleMl * ratio) / 100) * 1000) / 1000 : null
                const include = next.sprayIncludeBottle !== false
                next.sprayIncludeBottle = include

                // Formula: oil ml × oil rate + water ml × water rate + bottle (if on)
                const calc = calcSprayLinePaise({
                    bottleMl,
                    ratio,
                    oilRatePaise: next.oilRatePaise,
                    waterRatePaise: next.waterRatePaise,
                    bottlePricePaise: next.bottlePricePaise,
                    includeBottle: include,
                })
                next.sprayOilMl = calc.oilMl
                next.unitPricePaise = calc.unitPricePaise
                const qty =
                    typeof next.quantity === 'number' ? next.quantity : parseFloat(next.quantity) || 0
                next.lineTotalPaise = Math.max(
                    0,
                    Math.round(qty * calc.unitPricePaise) - (next.discountPaise || 0)
                )
                return next
            })
        )
    }

    const doClearCart = () => {
        setCart([])
        setAdditional(0)
        setDiscount(0)
        setCash('')
        setUpi('')
        setCustomer(null)
        setBillExpanded(false)
        setView('browse')
        useCartStore.getState().clearCart()
    }

    const payFullCash = () => {
        setCash(fromPaise(totalPaise).toString())
        setUpi('')
    }
    const payFullUpi = () => {
        setUpi(fromPaise(totalPaise).toString())
        setCash('')
    }
    const payRemainingCash = () => {
        const rem = Math.max(0, totalPaise - toPaise(upi || 0))
        setCash(fromPaise(rem).toString())
    }
    const payRemainingUpi = () => {
        const rem = Math.max(0, totalPaise - toPaise(cash || 0))
        setUpi(fromPaise(rem).toString())
    }

    const handleComplete = async () => {
        if (!cart.length) return
        const badQty = cart.some((i) => i.quantity === '' || i.quantity == null || Number(i.quantity) <= 0)
        if (badQty) {
            setErrorMsg('Fix empty quantities before completing the bill')
            return
        }
        const cashPaise = toPaise(cash || 0)
        const upiPaise = toPaise(upi || 0)
        if (cashPaise + upiPaise === 0) {
            setErrorMsg('Enter payment amounts (Cash or UPI)')
            return
        }
        if (cashPaise + upiPaise !== totalPaise) {
            setErrorMsg(`Payments must equal total ${formatINR(totalPaise)}. Now: ${formatINR(cashPaise + upiPaise)}`)
            return
        }

        const payments = []
        if (cashPaise > 0) payments.push({ method: 'CASH', amountPaise: cashPaise })
        if (upiPaise > 0) payments.push({ method: 'UPI', amountPaise: upiPaise })

        setSubmitting(true)
        try {
            const payload = {
                customerId: customer?.id || null,
                items: cart.map((item) => ({
                    productId: item.productId,
                    productName: item.productName,
                    productType: item.productType,
                    unit: item.unit,
                    quantity: item.quantity,
                    unitPricePaise: item.unitPricePaise,
                    discountPaise: item.discountPaise || 0,
                    sprayBottleMl: item.sprayBottleMl || null,
                    sprayOilMl: item.sprayOilMl || null,
                    oilRatioPercent:
                        item.productType === 'SPRAY' && item.oilRatioPercent != null
                            ? Number(item.oilRatioPercent)
                            : undefined,
                    sprayIncludeBottle:
                        item.productType === 'SPRAY' ? item.sprayIncludeBottle !== false : undefined,
                })),
                additionalPaise,
                discountPaise,
                payments,
            }
            const result = await completeBillSafe(payload)
            if (result.ok && result.invoice) {
                setCompletedInvoice(result.invoice)
                setCart([])
                setAdditional(0)
                setDiscount(0)
                setCash('')
                setUpi('')
                setCustomer(null)
                setBillExpanded(false)
                setView('browse')
                await useCartStore.getState().clearCart()
            } else if (result.pending) {
                setErrorMsg(result.message || 'Bill saved offline and will sync when online.')
                // Keep cart until staff confirms; optional: clear and show pending
                setCart([])
                setAdditional(0)
                setDiscount(0)
                setCash('')
                setUpi('')
                setCustomer(null)
                setBillExpanded(false)
                setView('browse')
                await useCartStore.getState().clearCart()
            } else {
                setErrorMsg(result.error || result.message || 'Failed to complete bill')
            }
        } catch (err) {
            setErrorMsg(err.message || 'Failed to complete bill')
        } finally {
            setSubmitting(false)
        }
    }

    const startNewBill = () => {
        setCompletedInvoice(null)
        setView('browse')
    }

    // ── Completed invoice (stays inside AppShell header + bottom nav) ──
    if (completedInvoice) {
        return (
            <div className="bg-ivory px-3 pt-3 pb-6 max-w-lg mx-auto">
                <div className="rounded-2xl bg-white border border-border shadow-soft overflow-hidden">
                    <div className="bg-emerald px-4 py-3 flex items-center justify-between">
                        <div>
                            <p className="text-white/70 text-[11px] font-medium uppercase tracking-wide">Receipt</p>
                            <p className="text-white font-semibold text-sm">{completedInvoice.invoiceNumber}</p>
                        </div>
                        <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center">
                            <Check className="text-gold" size={20} strokeWidth={2.5} />
                        </div>
                    </div>
                    <div className="px-4 pt-4 pb-2 text-center border-b border-border">
                        <p className="text-[11px] text-muted font-medium">Total paid</p>
                        <p className="text-2xl font-bold text-emerald tracking-tight mt-0.5">
                            {formatINR(completedInvoice.totalPaise)}
                        </p>
                        {completedInvoice.customer && (
                            <p className="text-xs text-muted mt-1.5">
                                {completedInvoice.customer?.name}
                                {completedInvoice.customer?.mobile ? ` · ${completedInvoice.customer.mobile}` : ''}
                            </p>
                        )}
                    </div>
                    <div className="px-4 py-3 space-y-1.5 max-h-48 overflow-y-auto">
                        {(completedInvoice.items || []).map((it) => (
                            <div key={it.id || it.productName} className="flex justify-between gap-2 text-sm">
                                <span className="truncate text-charcoal">
                                    {it.productName}
                                    {it.productType === 'PER_ML' ? ` · ${it.quantity} ml` : ''}
                                </span>
                                <span className="shrink-0 font-semibold text-charcoal">{formatINR(it.lineTotalPaise)}</span>
                            </div>
                        ))}
                    </div>
                    <div className="px-4 py-2.5 bg-ivory/80 border-t border-border text-[11px] text-muted">
                        Paid:{' '}
                        <span className="text-charcoal font-medium">
                            {(completedInvoice.payments || [])
                                .map((p) => `${p.method} ${formatINR(p.amountPaise)}`)
                                .join(' + ') || '—'}
                        </span>
                    </div>
                    <div className="p-3 space-y-2">
                        <a
                            href={getWhatsAppShareUrl(completedInvoice, 'Amwaj')}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-primary w-full text-center text-sm py-2.5 block"
                        >
                            {completedInvoice.customer?.mobile ? 'Send on WhatsApp' : 'Share on WhatsApp'}
                        </a>
                        <button
                            onClick={startNewBill}
                            className="w-full py-2.5 rounded-xl border border-border text-sm font-semibold text-charcoal active:bg-ivory"
                        >
                            New Bill
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    if (loading) {
        return <div className="flex items-center justify-center h-64 text-muted text-sm">Loading products…</div>
    }

    // ── Mobile Review Bill screen ──────────────────────────
    if (view === 'review') {
        return (
            <div className="min-h-full bg-ivory flex flex-col md:hidden">
                <header className="bg-white border-b border-border px-3 py-2.5 flex items-center gap-3 sticky top-0 z-20">
                    <button
                        onClick={() => setView('browse')}
                        className="w-9 h-9 rounded-xl bg-ivory border border-border flex items-center justify-center text-charcoal"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <h1 className="font-semibold text-sm text-charcoal">Review Bill</h1>
                        <p className="text-[11px] text-muted">{cart.length} items</p>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-8">
                    {/* Customer */}
                    <button
                        onClick={() => setShowCustomerModal(true)}
                        className="card w-full flex items-center gap-3 p-3.5 text-left"
                    >
                        <div className="w-10 h-10 rounded-full bg-emerald/10 flex items-center justify-center text-emerald">
                            <UserPlus size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">{customer ? customer.name : 'Walk-in customer'}</div>
                            <div className="text-xs text-muted">{customer ? customer.mobile : 'Tap to select or add'}</div>
                        </div>
                    </button>

                    {/* Items — same one-line qty controls as cart sheet / desktop */}
                    <div className="card divide-y divide-border px-2">
                        {sortedCart.map((item) => (
                            <CartLine
                                key={item.key}
                                item={item}
                                updateQty={updateQty}
                                setItemQty={setItemQty}
                                removeItem={removeItem}
                                updateSprayItem={updateSprayItem}
                                isOwner={user?.role === 'OWNER'}
                            />
                        ))}
                    </div>

                    {/* Charges */}
                    <div className="card p-4 space-y-3">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted">Subtotal</span>
                            <span>{formatINR(subtotalPaise)}</span>
                        </div>
                        <div className="flex justify-between text-sm items-center">
                            <span className="text-muted">Additional</span>
                            <input
                                type="number"
                                min="0"
                                value={additional || ''}
                                onChange={(e) => setAdditional(e.target.value)}
                                className="w-24 text-right border border-border rounded-lg px-2 py-1.5 text-sm"
                                placeholder="0"
                            />
                        </div>
                        <div className="flex justify-between text-sm items-center">
                            <span className="text-muted">Discount</span>
                            <input
                                type="number"
                                min="0"
                                value={discount || ''}
                                onChange={(e) => setDiscount(e.target.value)}
                                className="w-24 text-right border border-border rounded-lg px-2 py-1.5 text-sm"
                                placeholder="0"
                            />
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-border">
                            <span className="font-semibold">Total Payable</span>
                            <span className="text-xl font-bold text-emerald">{formatINR(totalPaise)}</span>
                        </div>
                    </div>

                    {/* Payment */}
                    <div className="card p-4 space-y-3">
                        <p className="text-sm font-semibold text-charcoal">Payment</p>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={payFullCash}
                                className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2.5 rounded-xl border transition-colors ${
                                    cashIsFull
                                        ? 'bg-emerald text-white border-emerald shadow-sm'
                                        : cashSelected
                                          ? 'bg-emerald/15 text-emerald border-emerald/50'
                                          : 'border-border text-muted bg-white'
                                }`}
                            >
                                <Banknote size={14} /> Cash
                            </button>
                            <button
                                type="button"
                                onClick={payFullUpi}
                                className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2.5 rounded-xl border transition-colors ${
                                    upiIsFull
                                        ? 'bg-gold text-emerald-dark border-gold shadow-sm'
                                        : upiSelected
                                          ? 'bg-gold/20 text-gold-dark border-gold/50'
                                          : 'border-border text-muted bg-white'
                                }`}
                            >
                                <Smartphone size={14} /> UPI
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <div className="flex justify-between mb-0.5">
                                    <label className="text-xs text-muted">Cash</label>
                                    {toPaise(upi || 0) > 0 && toPaise(upi || 0) < totalPaise && (
                                        <button
                                            type="button"
                                            onClick={payRemainingCash}
                                            className="text-[10px] text-emerald font-medium"
                                        >
                                            Fill rest
                                        </button>
                                    )}
                                </div>
                                <input
                                    type="number"
                                    min="0"
                                    value={cash}
                                    onChange={(e) => setCash(e.target.value)}
                                    className="input py-2 text-sm"
                                    placeholder="₹0"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between mb-0.5">
                                    <label className="text-xs text-muted">UPI</label>
                                    {toPaise(cash || 0) > 0 && toPaise(cash || 0) < totalPaise && (
                                        <button
                                            type="button"
                                            onClick={payRemainingUpi}
                                            className="text-[10px] text-emerald font-medium"
                                        >
                                            Fill rest
                                        </button>
                                    )}
                                </div>
                                <input
                                    type="number"
                                    min="0"
                                    value={upi}
                                    onChange={(e) => setUpi(e.target.value)}
                                    className="input py-2 text-sm"
                                    placeholder="₹0"
                                />
                            </div>
                        </div>
                        <div className="text-center text-xs text-muted">
                            {(() => {
                                const paid = toPaise(cash || 0) + toPaise(upi || 0)
                                const diff = totalPaise - paid
                                if (paid === 0) return 'Select Cash or UPI'
                                if (diff === 0) return <span className="text-emerald font-medium">✓ Exact amount</span>
                                if (diff > 0) return <span className="text-amber-600">Remaining {formatINR(diff)}</span>
                                return <span className="text-red-500">Over by {formatINR(-diff)}</span>
                            })()}
                        </div>
                    </div>

                    <button
                        onClick={handleComplete}
                        disabled={!cart.length || submitting}
                        className="btn-primary w-full flex items-center justify-center gap-2 py-3.5"
                    >
                        <Check size={18} />
                        {submitting ? 'Generating…' : 'Generate Bill'}
                    </button>
                </div>

                <CustomerAndModals
                    showCustomerModal={showCustomerModal}
                    setShowCustomerModal={setShowCustomerModal}
                    setCustomer={setCustomer}
                    confirmClear={confirmClear}
                    setConfirmClear={setConfirmClear}
                    doClearCart={doClearCart}
                    errorMsg={errorMsg}
                    setErrorMsg={setErrorMsg}
                />
            </div>
        )
    }

    // ── Main browse (mobile + desktop) ─────────────────────
    return (
        <div className="flex flex-col h-full md:flex-row md:h-[calc(100vh-0px)]">
            {/* ── Product catalog ── */}
            <div className="flex-1 flex flex-col min-h-0 md:border-r border-border">
                {/* Bill toolbar — global Amwaj header lives in AppShell */}
                <div className="bg-white border-b border-border px-3 py-2.5 shrink-0 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                        <h1 className="text-sm font-bold text-charcoal leading-tight">New Bill</h1>
                        <p className="text-[11px] text-muted">Select products</p>
                    </div>
                    <button
                        onClick={() => setShowCustomerModal(true)}
                        className="flex items-center gap-1.5 bg-emerald text-white text-xs font-semibold px-3 py-2 rounded-xl shrink-0 active:bg-emerald-dark"
                    >
                        <UserPlus size={14} />
                        {customer ? (customer.name || '').split(' ')[0] : 'Customer'}
                    </button>
                </div>

                {/* Categories — icon on top, name below; even tiles */}
                <div className="px-3 py-2 shrink-0 bg-white border-b border-border">
                    <div className="grid grid-cols-5 gap-1.5">
                        {(Array.isArray(categories) ? categories : []).map((cat) => {
                            const active = activeCategory === cat.id
                            const Icon = CATEGORY_ICON[cat.name] || Package
                            return (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => setActiveCategory(cat.id)}
                                    className={`flex flex-col items-center justify-center gap-1 py-2 px-0.5 rounded-xl transition-colors min-h-[58px] ${
                                        active
                                            ? 'bg-emerald text-white shadow-sm'
                                            : 'bg-ivory text-charcoal border border-border'
                                    }`}
                                >
                                    <Icon size={18} strokeWidth={2} className={active ? 'text-gold' : 'text-emerald'} />
                                    <span
                                        className={`text-[10px] font-semibold leading-tight text-center truncate w-full px-0.5 ${
                                            active ? 'text-white' : 'text-muted'
                                        }`}
                                    >
                                        {cat.name}
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Search */}
                <div className="px-3 pb-2 shrink-0">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
                        <input
                            className="input pl-9 py-2 text-sm"
                            placeholder="Search products…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                {/* Product grid: 2 per row (mobile + desktop). Spray groups expand in place. */}

                {/* Product grid: 2 per row. Each card keeps its own height. */}
                <div className="flex-1 overflow-y-auto px-3 pb-28 md:pb-4">
                    {catalogRows.length === 0 ? (
                        <p className="text-center text-muted text-sm py-10">No products found</p>
                    ) : (
                        <div className="grid grid-cols-2 items-start content-start gap-2">
                            {catalogRows.map((row) => {
                                const p = row.product
                                const isSpray = p?.productType === 'SPRAY'
                                return (
                                    <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => addProduct(p)}
                                        className="self-start w-full bg-white rounded-2xl border border-[#E5E0D8] shadow-[0_1px_2px_rgba(0,0,0,0.04)] px-3 py-2.5 text-left active:scale-[0.98] transition-transform flex items-center gap-2 min-h-[56px]"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="font-semibold text-[13px] text-charcoal leading-tight truncate">
                                                {p?.name || 'Product'}
                                            </div>
                                            <div className="text-[12px] text-muted mt-0.5 truncate">
                                                {p?.productType === 'PER_ML' || isSpray
                                                    ? `${formatINR(p?.unitPrice)}/ml`
                                                    : formatINR(p?.unitPrice)}
                                                {isSpray ? ' · sizes' : ''}
                                            </div>
                                        </div>
                                        <span className="w-7 h-7 rounded-full bg-emerald text-white flex items-center justify-center shrink-0">
                                            <Plus size={14} strokeWidth={2.5} />
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Spray size picker — bottom sheet; does not stretch catalog grid */}
            {sizePickProduct && (
                <div
                    className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40"
                    onClick={() => setSizePickProduct(null)}
                >
                    <div
                        className="w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-4 shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <div className="font-semibold text-charcoal">{sizePickProduct.name}</div>
                                <div className="text-xs text-muted">
                                    {formatINR(sizePickProduct.unitPrice)}/ml · choose bottle size
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSizePickProduct(null)}
                                className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {SPRAY_SIZES.map((ml) => {
                                const list = Array.isArray(products) ? products : []
                                let oilR = sizePickProduct.oilProduct?.unitPrice
                                    ? Number(sizePickProduct.oilProduct.unitPrice)
                                    : 0
                                if (!oilR && sizePickProduct.oilProductId) {
                                    const o = list.find((x) => x.id === sizePickProduct.oilProductId)
                                    if (o?.unitPrice) oilR = Number(o.unitPrice)
                                }
                                if (!oilR) oilR = Number(sizePickProduct.unitPrice) || 0
                                let waterR = 0
                                const waterSku = list.find(
                                    (x) =>
                                        !x.isGroup &&
                                        (x.name || '').toLowerCase().includes('spray water')
                                )
                                if (waterSku?.unitPrice) waterR = Number(waterSku.unitPrice)
                                let bottleP = 0
                                const bottleSku = list.find(
                                    (x) =>
                                        x.productType === 'FIXED' &&
                                        !x.isGroup &&
                                        Number(x.bottleSizeMl) === Number(ml)
                                )
                                if (bottleSku?.unitPrice) bottleP = Number(bottleSku.unitPrice)
                                const price = calcSprayLinePaise({
                                    bottleMl: ml,
                                    ratio: 50,
                                    oilRatePaise: oilR,
                                    waterRatePaise: waterR,
                                    bottlePricePaise: bottleP,
                                    includeBottle: true,
                                }).unitPricePaise
                                return (
                                    <button
                                        key={ml}
                                        type="button"
                                        onClick={() => addSpraySize(sizePickProduct, ml)}
                                        className="rounded-xl border border-border bg-ivory/50 py-3 px-2 text-center active:scale-[0.98] transition-transform"
                                    >
                                        <div className="font-bold text-sm text-charcoal">{ml} ml</div>
                                        <div className="text-[11px] text-emerald font-semibold mt-0.5">
                                            {formatINR(price)}
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Desktop cart panel (unchanged structure) ── */}
            <div className="hidden md:flex bg-white md:w-[360px] lg:w-[400px] flex-col shrink-0 border-l border-border h-full">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                    <div className="font-semibold text-charcoal text-sm">Bill Items ({cart.length})</div>
                    {cart.length > 0 && (
                        <button
                            onClick={() => setConfirmClear(true)}
                            className="text-muted text-sm flex items-center gap-1"
                        >
                            <Trash2 size={14} /> Clear
                        </button>
                    )}
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
                    {cart.length === 0 ? (
                        <p className="text-center text-muted text-sm py-8">Add products to start a bill</p>
                    ) : (
                        sortedCart.map((item) => (
                            <CartLine
                                key={item.key}
                                item={item}
                                updateQty={updateQty}
                                setItemQty={setItemQty}
                                removeItem={removeItem}
                                updateSprayItem={updateSprayItem}
                                isOwner={user?.role === 'OWNER'}
                            />
                        ))
                    )}
                </div>
                <DesktopPayFooter
                    cart={cart}
                    subtotalPaise={subtotalPaise}
                    additional={additional}
                    setAdditional={setAdditional}
                    discount={discount}
                    setDiscount={setDiscount}
                    totalPaise={totalPaise}
                    cash={cash}
                    setCash={setCash}
                    upi={upi}
                    setUpi={setUpi}
                    payFullCash={payFullCash}
                    payFullUpi={payFullUpi}
                    payRemainingCash={payRemainingCash}
                    payRemainingUpi={payRemainingUpi}
                    handleComplete={handleComplete}
                    submitting={submitting}
                />
            </div>

            {/* ── Mobile fixed bottom bill bar ── */}
            <div className="md:hidden fixed bottom-[calc(3.5rem+var(--safe-bottom))] inset-x-0 z-30 pointer-events-none">
                {/* Expanded sheet */}
                {billExpanded && cart.length > 0 && (
                    <div className="pointer-events-auto bg-white rounded-t-3xl shadow-[0_-8px_40px_rgba(0,0,0,0.12)] border-t border-border max-h-[75vh] flex flex-col animate-sheet-up">
                        <button
                            onClick={() => setBillExpanded(false)}
                            className="flex items-center justify-center gap-1 pt-2.5 pb-1 text-muted"
                        >
                            <div className="w-10 h-1 rounded-full bg-border" />
                        </button>
                        <div className="px-4 pb-2 flex items-center justify-between">
                            <span className="font-semibold text-sm">Bill Items ({cart.length})</span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setConfirmClear(true)}
                                    className="text-xs text-muted flex items-center gap-1"
                                >
                                    <Trash2 size={12} /> Clear
                                </button>
                                <button
                                    onClick={() => setBillExpanded(false)}
                                    className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-charcoal bg-ivory active:bg-border"
                                    aria-label="Close bill items"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto px-4 space-y-1 min-h-0 max-h-[45vh]">
                            {sortedCart.map((item) => (
                                <CartLine
                                    key={item.key}
                                    item={item}
                                    updateQty={updateQty}
                                    setItemQty={setItemQty}
                                    removeItem={removeItem}
                                    updateSprayItem={updateSprayItem}
                                    isOwner={user?.role === 'OWNER'}
                                    compact
                                />
                            ))}
                        </div>
                        <div className="px-4 py-2.5 border-t border-border space-y-1.5 shrink-0">
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-muted">{cart.length} items</span>
                                <span className="font-bold text-emerald text-sm">{formatINR(totalPaise)}</span>
                            </div>
                            <button
                                onClick={() => {
                                    setBillExpanded(false)
                                    setView('review')
                                }}
                                className="btn-primary w-full py-2.5 text-sm"
                            >
                                Review Bill →
                            </button>
                        </div>
                    </div>
                )}

                {/* Collapsed bar — margin above bottom nav, compact controls */}
                {!billExpanded && (
                    <div className="pointer-events-auto mx-3 mb-3">
                        <div className="bg-white rounded-2xl shadow-card border border-border px-3 py-2 flex items-center gap-2.5">
                            {cart.length === 0 ? (
                                <div className="flex-1 text-xs text-muted text-center py-1">Add products to start</div>
                            ) : (
                                <>
                                    <button onClick={() => setBillExpanded(true)} className="flex-1 text-left min-w-0">
                                        <div className="text-[11px] text-muted flex items-center gap-1">
                                            Bill items ({cart.length})
                                            <ChevronUp size={12} />
                                        </div>
                                        <div className="font-bold text-emerald text-sm leading-tight">
                                            {formatINR(totalPaise)}
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => setView('review')}
                                        className="shrink-0 bg-emerald text-white text-xs font-semibold px-3.5 py-2 rounded-xl active:bg-emerald-dark"
                                    >
                                        Review Bill →
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <CustomerAndModals
                showCustomerModal={showCustomerModal}
                setShowCustomerModal={setShowCustomerModal}
                setCustomer={setCustomer}
                confirmClear={confirmClear}
                setConfirmClear={setConfirmClear}
                doClearCart={doClearCart}
                errorMsg={errorMsg}
                setErrorMsg={setErrorMsg}
            />
        </div>
    )
}

/* ── Shared cart line (single-row: name + qty + price) ─── */
function CartLine({ item, updateQty, setItemQty, removeItem, updateSprayItem, isOwner, compact }) {
    const [mixOpen, setMixOpen] = useState(false)
    const isSpray = item.productType === 'SPRAY'
    const ratio = Number(item.oilRatioPercent ?? 50)
    const waterPct = Math.round((100 - ratio) * 10) / 10
    const oilMl = item.sprayOilMl
    const waterMl =
        item.sprayBottleMl != null && oilMl != null
            ? Math.round((item.sprayBottleMl - oilMl) * 1000) / 1000
            : null
    const bottleOn = item.sprayIncludeBottle !== false
    const bottleP = item.bottlePricePaise || 0
    const canTune = isSpray && updateSprayItem && item.sprayBottleMl

    const unitLabel =
        item.productType === 'PER_ML'
            ? `${formatINR(item.unitPricePaise)}/ml`
            : isSpray && item.sprayBottleMl
              ? `${item.sprayBottleMl} ml${bottleOn ? '' : ' · no bottle'}`
              : formatINR(item.unitPricePaise)

    const qtyDisplay = item.quantity === '' || item.quantity == null ? '' : item.quantity

    const onQtyBlur = () => {
        if (qtyDisplay === '' || qtyDisplay == null) {
            removeItem(item.key)
            return
        }
        const num = parseFloat(qtyDisplay)
        if (isNaN(num) || num <= 0) removeItem(item.key)
    }

    const setRatio = (n) => {
        const v = Math.min(100, Math.max(0, Math.round(Number(n))))
        if (!Number.isFinite(v)) return
        updateSprayItem(item.key, { oilRatioPercent: v })
    }

    return (
        <div className={compact ? 'py-2 border-b border-border last:border-0' : 'py-1.5'}>
            <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate leading-tight">{item.productName}</div>
                    <div className="text-[11px] text-muted truncate">{unitLabel}</div>
                </div>

                {canTune && (
                    <button
                        type="button"
                        onClick={() => setMixOpen((o) => !o)}
                        className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 transition-colors ${
                            mixOpen
                                ? 'border-emerald bg-emerald/10 text-emerald'
                                : 'border-border text-muted'
                        }`}
                        aria-label={mixOpen ? 'Hide mix' : 'Adjust mix'}
                        title="Oil mix & bottle"
                    >
                        <ChevronDown
                            size={14}
                            className={`transition-transform ${mixOpen ? 'rotate-180' : ''}`}
                        />
                    </button>
                )}

                <div className="flex items-center gap-1 shrink-0">
                    <button
                        onClick={() => updateQty(item.key, -1)}
                        className="w-7 h-7 rounded-lg border border-border flex items-center justify-center"
                        aria-label="Decrease"
                    >
                        <Minus size={13} />
                    </button>
                    <input
                        type="number"
                        inputMode="decimal"
                        step={item.productType === 'PER_ML' ? 0.5 : 1}
                        min="0"
                        value={qtyDisplay}
                        onChange={(e) => setItemQty(item.key, e.target.value)}
                        onBlur={onQtyBlur}
                        className="w-11 text-center text-sm border border-border rounded-lg py-0.5"
                    />
                    <button
                        onClick={() => updateQty(item.key, 1)}
                        className="w-7 h-7 rounded-lg border border-border flex items-center justify-center"
                        aria-label="Increase"
                    >
                        <Plus size={13} />
                    </button>
                </div>

                <span className="font-semibold text-sm w-14 text-right shrink-0">
                    {formatINR(item.lineTotalPaise)}
                </span>

                <button
                    onClick={() => removeItem(item.key)}
                    className="w-7 h-7 rounded-lg text-muted flex items-center justify-center shrink-0"
                    aria-label="Remove"
                >
                    <X size={14} />
                </button>
            </div>

            {canTune && mixOpen && (
                <div className="mt-2 rounded-2xl border border-border/80 bg-ivory/50 p-3 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                            Oil / water
                        </span>
                        <span className="text-[11px] tabular-nums text-charcoal font-medium">
                            {oilMl != null ? (
                                <>
                                    <span className="text-emerald">{oilMl} ml oil</span>
                                    <span className="text-muted"> · </span>
                                    <span>{waterMl} ml water</span>
                                </>
                            ) : (
                                `${ratio}% oil`
                            )}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setRatio(ratio - 5)}
                            className="w-9 h-9 rounded-xl border border-border bg-white flex items-center justify-center text-muted active:bg-ivory"
                            aria-label="Less oil"
                        >
                            <Minus size={14} />
                        </button>
                        <div className="flex-1">
                            <input
                                type="range"
                                min={0}
                                max={100}
                                step={5}
                                value={ratio}
                                onChange={(e) => setRatio(e.target.value)}
                                className="w-full accent-emerald h-2 cursor-pointer"
                            />
                            <div className="flex justify-between text-[10px] text-muted mt-1 px-0.5">
                                <span>Oil {ratio}%</span>
                                <span>Water {waterPct}%</span>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setRatio(ratio + 5)}
                            className="w-9 h-9 rounded-xl border border-border bg-white flex items-center justify-center text-muted active:bg-ivory"
                            aria-label="More oil"
                        >
                            <Plus size={14} />
                        </button>
                    </div>

                    <label className="flex items-center justify-between gap-3 rounded-xl bg-white border border-border px-3 py-2.5 cursor-pointer">
                        <span className="text-xs font-medium text-charcoal min-w-0">
                            {item.sprayBottleMl} ml bottle
                            {!bottleOn && bottleP > 0 ? (
                                <span className="block text-[10px] text-muted font-normal">
                                    Not charged · −{formatINR(bottleP)}
                                </span>
                            ) : (
                                <span className="block text-[10px] text-muted font-normal">
                                    Include in price & stock
                                </span>
                            )}
                        </span>
                        <input
                            type="checkbox"
                            className="w-5 h-5 rounded border-border text-emerald accent-emerald shrink-0"
                            checked={bottleOn}
                            onChange={() =>
                                updateSprayItem(item.key, { sprayIncludeBottle: !bottleOn })
                            }
                        />
                    </label>
                </div>
            )}
        </div>
    )
}

/* ── Desktop payment footer ─────────────────────────────── */
function DesktopPayFooter({
    cart,
    subtotalPaise,
    additional,
    setAdditional,
    discount,
    setDiscount,
    totalPaise,
    cash,
    setCash,
    upi,
    setUpi,
    payFullCash,
    payFullUpi,
    payRemainingCash,
    payRemainingUpi,
    handleComplete,
    submitting,
}) {
    return (
        <div className="border-t border-border px-4 py-3 space-y-2 bg-ivory/50">
            <div className="flex justify-between text-sm">
                <span className="text-muted">Subtotal</span>
                <span>{formatINR(subtotalPaise)}</span>
            </div>
            <div className="flex justify-between text-sm items-center">
                <span className="text-muted">Additional</span>
                <input
                    type="number"
                    min="0"
                    value={additional || ''}
                    onChange={(e) => setAdditional(e.target.value)}
                    className="w-24 text-right border border-border rounded-lg px-2 py-1 text-sm"
                    placeholder="0"
                />
            </div>
            <div className="flex justify-between text-sm items-center">
                <span className="text-muted">Discount</span>
                <input
                    type="number"
                    min="0"
                    value={discount || ''}
                    onChange={(e) => setDiscount(e.target.value)}
                    className="w-24 text-right border border-border rounded-lg px-2 py-1 text-sm"
                    placeholder="0"
                />
            </div>
            <div className="flex justify-between items-center pt-1">
                <span className="font-semibold">Total Payable</span>
                <span className="text-xl font-bold text-emerald">{formatINR(totalPaise)}</span>
            </div>
            {cart.length > 0 && totalPaise > 0 && (
                <div className="flex gap-2 pt-1">
                    <button
                        type="button"
                        onClick={payFullCash}
                        className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-xl border transition-colors ${
                            toPaise(cash || 0) === totalPaise && toPaise(upi || 0) === 0
                                ? 'bg-emerald text-white border-emerald shadow-sm'
                                : toPaise(cash || 0) > 0
                                  ? 'bg-emerald/15 text-emerald border-emerald/50'
                                  : 'border-border text-muted bg-white'
                        }`}
                    >
                        <Banknote size={14} /> Cash
                    </button>
                    <button
                        type="button"
                        onClick={payFullUpi}
                        className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-xl border transition-colors ${
                            toPaise(upi || 0) === totalPaise && toPaise(cash || 0) === 0
                                ? 'bg-gold text-emerald-dark border-gold shadow-sm'
                                : toPaise(upi || 0) > 0
                                  ? 'bg-gold/20 text-gold-dark border-gold/50'
                                  : 'border-border text-muted bg-white'
                        }`}
                    >
                        <Smartphone size={14} /> UPI
                    </button>
                </div>
            )}
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <div className="flex justify-between mb-0.5">
                        <label className="text-xs text-muted">Cash</label>
                        {toPaise(upi || 0) > 0 && toPaise(upi || 0) < totalPaise && (
                            <button
                                type="button"
                                onClick={payRemainingCash}
                                className="text-[10px] text-emerald font-medium"
                            >
                                Fill rest
                            </button>
                        )}
                    </div>
                    <input
                        type="number"
                        min="0"
                        value={cash}
                        onChange={(e) => setCash(e.target.value)}
                        className="input py-2 text-sm"
                        placeholder="₹0"
                    />
                </div>
                <div>
                    <div className="flex justify-between mb-0.5">
                        <label className="text-xs text-muted">UPI</label>
                        {toPaise(cash || 0) > 0 && toPaise(cash || 0) < totalPaise && (
                            <button
                                type="button"
                                onClick={payRemainingUpi}
                                className="text-[10px] text-emerald font-medium"
                            >
                                Fill rest
                            </button>
                        )}
                    </div>
                    <input
                        type="number"
                        min="0"
                        value={upi}
                        onChange={(e) => setUpi(e.target.value)}
                        className="input py-2 text-sm"
                        placeholder="₹0"
                    />
                </div>
            </div>
            <button
                onClick={handleComplete}
                disabled={!cart.length || submitting}
                className="btn-primary w-full mt-1 flex items-center justify-center gap-2"
            >
                <Check size={18} />
                {submitting ? 'Generating…' : 'Generate Bill'}
            </button>
        </div>
    )
}

/* ── Shared modals ──────────────────────────────────────── */
function CustomerAndModals({
    showCustomerModal,
    setShowCustomerModal,
    setCustomer,
    confirmClear,
    setConfirmClear,
    doClearCart,
    errorMsg,
    setErrorMsg,
}) {
    return (
        <>
            {showCustomerModal && (
                <CustomerQuickSelect
                    onClose={() => setShowCustomerModal(false)}
                    onSelect={(c) => {
                        setCustomer(c)
                        setShowCustomerModal(false)
                    }}
                />
            )}
            <ConfirmModal
                open={confirmClear}
                onClose={() => setConfirmClear(false)}
                onConfirm={doClearCart}
                title="Clear bill?"
                message="All items, discount and payments will be removed."
                confirmLabel="Clear"
                danger
            />
            <Modal
                open={!!errorMsg}
                onClose={() => setErrorMsg('')}
                title="Notice"
                size="sm"
                footer={
                    <button onClick={() => setErrorMsg('')} className="btn-primary w-full">
                        OK
                    </button>
                }
            >
                <p className="text-sm text-muted">{errorMsg}</p>
            </Modal>
        </>
    )
}

function CustomerQuickSelect({ onClose, onSelect }) {
    const [search, setSearch] = useState('')
    const [list, setList] = useState([])
    const [name, setName] = useState('')
    const [mobile, setMobile] = useState('')
    const [err, setErr] = useState('')

    useEffect(() => {
        const t = setTimeout(
            () => {
                api.getCustomers(search).then(setList).catch(console.error)
            },
            search ? 250 : 0
        )
        return () => clearTimeout(t)
    }, [search])

    const create = async () => {
        if (!name.trim() || !mobile.trim()) {
            setErr('Name and mobile are required')
            return
        }
        try {
            const c = await api.createCustomer({ name: name.trim(), mobile: mobile.trim() })
            onSelect(c)
        } catch (error) {
            if (error.message?.includes('already exists')) {
                const existing = await api.getCustomers(mobile)
                if (existing[0]) onSelect(existing[0])
                else setErr(error.message)
            } else {
                setErr(error.message || 'Could not create customer')
            }
        }
    }

    return (
        <Modal open onClose={onClose} title="Select Customer">
            <div className="space-y-3">
                <input
                    className="input py-2.5 text-sm"
                    placeholder="Search by name or mobile"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    autoFocus
                />
                <div className="space-y-1 max-h-36 overflow-y-auto">
                    {list.length === 0 ? (
                        <p className="text-xs text-muted text-center py-3">No customers found</p>
                    ) : (
                        list.map((c) => (
                            <button
                                key={c.id}
                                onClick={() => onSelect(c)}
                                className="w-full text-left px-3 py-2.5 rounded-xl active:bg-ivory text-sm"
                            >
                                <div className="font-medium">{c.name}</div>
                                <div className="text-muted text-xs">{c.mobile}</div>
                            </button>
                        ))
                    )}
                </div>
                <div className="border-t border-border pt-3 space-y-2">
                    <p className="text-xs text-muted font-medium">Or create new</p>
                    <input
                        className="input py-2.5 text-sm"
                        placeholder="Name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                    <input
                        className="input py-2.5 text-sm"
                        placeholder="Mobile"
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value)}
                        inputMode="tel"
                    />
                    {err && <p className="text-xs text-red-600">{err}</p>}
                    <button onClick={create} className="btn-primary w-full text-sm py-2.5">
                        Create & Select
                    </button>
                </div>
                <button onClick={() => onSelect(null)} className="w-full text-center text-sm text-muted py-2">
                    Continue as Walk-in
                </button>
            </div>
        </Modal>
    )
}
