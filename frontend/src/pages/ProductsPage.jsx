import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { api, formatINR } from '../services/api'
import {
    Plus,
    Package,
    Pencil,
    Trash2,
    ChevronLeft,
    ChevronRight,
    Search,
    Droplet,
    SprayCan,
    Flame,
    Box,
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../lib/queryClient'
import { cacheProducts, cacheCategories, getCachedProducts, getCachedCategories } from '../lib/db'
import { ConfirmModal } from '../components/Modal'
import { useAuth } from '../context/AuthContext'

const PAGE_SIZE = 15

const CATEGORY_ICON = {
    Attar: Droplet,
    Oud: Package,
    Spray: SprayCan,
    Bakhoor: Flame,
    Accessories: Box,
}

const emptyForm = {
    name: '',
    categoryId: '',
    productType: 'PER_ML',
    unitPrice: '',
    purchasePrice: '',
    unit: 'ml',
    isGroup: false,
    parentId: '',
    bottleSizeMl: '',
    stockQty: '',
    oilProductId: '',
    waterProductId: '',
    bottleProductId: '',
    oilRatioPercent: '50',
    sortOrder: '0',
    mirrorFragrance: false, // Attar + Oud + Spray in one go
}

function formatStock(p) {
    if (!p || p.isGroup) return null
    const n = Number(p.stockQty)
    if (!Number.isFinite(n)) return '0'
    const unit = p.productType === 'PER_ML' ? 'ml' : p.unit || 'pcs'
    // trim trailing zeros for display
    const s = Number.isInteger(n) ? String(n) : String(Math.round(n * 1000) / 1000)
    return `${s} ${unit}`
}

function asArray(data) {
    if (Array.isArray(data)) return data
    if (data && Array.isArray(data.items)) return data.items
    return []
}

export default function ProductsPage() {
    const qc = useQueryClient()
    const { user } = useAuth()
    const isOwner = user?.role === 'OWNER'
    const [products, setProducts] = useState([])
    const [categories, setCategories] = useState([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editing, setEditing] = useState(null)
    const [form, setForm] = useState(emptyForm)
    const [search, setSearch] = useState('')
    const [categoryId, setCategoryId] = useState('')
    const [page, setPage] = useState(0)
    const [error, setError] = useState('')
    const [deleteId, setDeleteId] = useState(null)
    const [busy, setBusy] = useState(false)
    const [refreshing, setRefreshing] = useState(false)
    const [expandedGroups, setExpandedGroups] = useState(() => new Set())

    const toggleGroup = (id) => {
        setExpandedGroups((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    /** Keep Bill catalog (active only) + IDB in sync after management changes */
    const syncCache = useCallback(
        async (list) => {
            const all = asArray(list)
            const active = all.filter((x) => x?.isActive !== false)
            qc.setQueryData(queryKeys.products, active)
            // Full list in IDB so Products page hydrates offline too
            await cacheProducts(all).catch(console.error)
        },
        [qc]
    )

    /** Instant hydrate from IndexedDB / Query cache, then background network refresh */
    useEffect(() => {
        let cancelled = false

        const hydrate = async () => {
            try {
                const fromQc = asArray(qc.getQueryData(queryKeys.products))
                const catsQc = asArray(qc.getQueryData(queryKeys.categories))
                const [fromIdb, catsIdb] = await Promise.all([
                    getCachedProducts().catch(() => []),
                    getCachedCategories().catch(() => []),
                ])
                const prods = asArray(fromIdb).length ? asArray(fromIdb) : fromQc
                const cats = asArray(catsIdb).length ? asArray(catsIdb) : catsQc

                if (!cancelled && prods.length) {
                    setProducts(prods)
                    setLoading(false)
                }
                if (!cancelled && cats.length) {
                    setCategories(cats)
                    setCategoryId((prev) => prev || cats[0]?.id || '')
                    setForm((f) => ({ ...f, categoryId: f.categoryId || cats[0]?.id || '' }))
                }
                if (!cancelled && (prods.length || cats.length)) setLoading(false)
            } catch (e) {
                console.error('Products IDB hydrate failed', e)
            }
        }

        const refresh = async () => {
            setRefreshing(true)
            setError('')
            try {
                const [p, c] = await Promise.all([api.getProducts({ active: 'false' }), api.getCategories()])
                if (cancelled) return
                const cats = asArray(c)
                const list = asArray(p)
                setProducts(list)
                setCategories(cats)
                if (cats[0]) {
                    setCategoryId((prev) => prev || cats[0].id)
                    setForm((f) => ({ ...f, categoryId: f.categoryId || cats[0].id }))
                }
                await syncCache(list)
                await cacheCategories(cats).catch(console.error)
                qc.setQueryData(queryKeys.categories, cats)
            } catch (err) {
                console.error(err)
                if (!cancelled) {
                    setError(err?.message || 'Failed to load products')
                    setProducts((prev) => (prev.length ? prev : []))
                }
            } finally {
                if (!cancelled) {
                    setLoading(false)
                    setRefreshing(false)
                }
            }
        }

        hydrate().then(() => refresh())
        return () => {
            cancelled = true
        }
    }, [qc, syncCache])

    /** Catalog rows: groups (expandable) + standalone — case-insensitive search */
    const catalogRows = useMemo(() => {
        let list = Array.isArray(products) ? products : []
        if (categoryId) list = list.filter((p) => p?.categoryId === categoryId)
        const q = search.trim().toLowerCase()
        const match = (p) => {
            if (!q) return true
            return (
                (p?.name || '').toLowerCase().includes(q) ||
                (p?.category?.name || '').toLowerCase().includes(q) ||
                (p?.bottleSizeMl != null && String(p.bottleSizeMl).includes(q))
            )
        }

        // Flat list like Attar: no size-children. Sprays are single products.
        const standalone = list.filter((p) => !p.isGroup && !p.parentId)
        return standalone
            .filter(match)
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
            .map((p) => ({ type: 'product', product: p }))
    }, [products, search, categoryId])

    /** Parent options for size variants (groups in same category) */
    const groupParents = useMemo(() => {
        return (Array.isArray(products) ? products : []).filter(
            (p) => p.isGroup && (!form.categoryId || p.categoryId === form.categoryId)
        )
    }, [products, form.categoryId])

    /** Oils (PER_ML) for spray recipe */
    const oilOptions = useMemo(
        () => (Array.isArray(products) ? products : []).filter((p) => p.productType === 'PER_ML' && !p.isGroup),
        [products]
    )
    /** Water / diluent candidates */
    const waterOptions = useMemo(
        () =>
            (Array.isArray(products) ? products : []).filter(
                (p) =>
                    !p.isGroup &&
                    (p.name?.toLowerCase().includes('water') ||
                        (p.productType === 'FIXED' && p.unit === 'ml'))
            ),
        [products]
    )
    /** Empty bottles */
    const bottleOptions = useMemo(
        () =>
            (Array.isArray(products) ? products : []).filter(
                (p) =>
                    !p.isGroup &&
                    p.productType === 'FIXED' &&
                    (p.bottleSizeMl != null || (p.name || '').toLowerCase().includes('bottle'))
            ),
        [products]
    )

    // Count rows for pagination (groups count as 1 when collapsed)
    const totalPages = Math.max(1, Math.ceil(catalogRows.length / PAGE_SIZE))
    const pageRows = catalogRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

    useEffect(() => {
        setPage(0)
    }, [search, categoryId])

    const openCreate = () => {
        setEditing(null)
        setForm({
            ...emptyForm,
            categoryId: categoryId || categories[0]?.id || '',
        })
        setShowForm(true)
    }

    const openEdit = (p) => {
        setEditing(p)
        setForm({
            name: p.name || '',
            categoryId: p.categoryId || p.category?.id || '',
            productType: p.productType || 'PER_ML',
            unitPrice: p.isGroup ? '' : ((p.unitPrice || 0) / 100).toString(),
            purchasePrice:
                p.purchasePrice != null && p.purchasePrice !== undefined ? (p.purchasePrice / 100).toString() : '',
            unit: p.unit || (p.productType === 'PER_ML' ? 'ml' : 'piece'),
            isGroup: Boolean(p.isGroup),
            parentId: p.parentId || '',
            bottleSizeMl: p.bottleSizeMl != null ? String(p.bottleSizeMl) : '',
            stockQty:
                p.isGroup
                    ? ''
                    : p.stockQty != null && p.stockQty !== undefined
                      ? String(Number(p.stockQty))
                      : '0',
            oilProductId: p.oilProductId || '',
            waterProductId: p.waterProductId || '',
            bottleProductId: p.bottleProductId || '',
            oilRatioPercent:
                p.oilRatioPercent != null && p.oilRatioPercent !== undefined
                    ? String(Number(p.oilRatioPercent))
                    : '50',
            sortOrder: String(p.sortOrder ?? 0),
            mirrorFragrance: false,
        })
        setShowForm(true)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setBusy(true)
        setError('')
        const isGroup = form.productType === 'SPRAY' ? false : Boolean(form.isGroup)
        const basePayload = {
            name: form.name.trim(),
            categoryId: form.categoryId,
            productType: form.productType,
            unitPrice: isGroup ? 0 : Math.round(Number(form.unitPrice) * 100),
            unit: form.unit || (form.productType === 'PER_ML' || form.productType === 'SPRAY' ? 'ml' : 'piece'),
            isGroup,
            parentId: isGroup ? null : form.parentId || null,
            bottleSizeMl:
                !isGroup && form.bottleSizeMl !== '' && form.bottleSizeMl != null
                    ? Math.round(Number(form.bottleSizeMl))
                    : null,
            stockQty: isGroup ? 0 : Math.max(0, Number(form.stockQty) || 0),
            oilProductId: form.oilProductId || null,
            waterProductId: form.waterProductId || null,
            bottleProductId: isGroup ? null : form.bottleProductId || null,
            oilRatioPercent: Math.min(100, Math.max(0, Number(form.oilRatioPercent) || 50)),
            sortOrder: Math.round(Number(form.sortOrder) || 0),
        }

        if (!isGroup && (!Number.isFinite(basePayload.unitPrice) || basePayload.unitPrice <= 0)) {
            setError('Selling price is required for sellable products')
            setBusy(false)
            return
        }

        if (isOwner) {
            const pr = form.purchasePrice
            if (pr !== '' && pr != null) {
                const n = Math.round(Number(pr) * 100)
                if (!Number.isFinite(n) || n < 0) {
                    setError('Purchase rate must be a valid amount (₹)')
                    setBusy(false)
                    return
                }
                basePayload.purchasePrice = n
            } else {
                basePayload.purchasePrice = null
            }
        }

        /** Resolve Attar / Oud / Spray category ids by name */
        const fragranceCats = () => {
            const want = ['attar', 'oud', 'spray']
            const out = []
            for (const w of want) {
                const c = (categories || []).find((x) => (x.name || '').toLowerCase() === w)
                if (c) out.push(c)
            }
            return out
        }

        const payloadForCategory = (cat) => {
            const name = (cat.name || '').toLowerCase()
            const isSprayCat = name === 'spray'
            return {
                ...basePayload,
                categoryId: cat.id,
                // Spray section uses SPRAY type (size picker on bill); Attar/Oud stay PER_ML
                productType: isSprayCat ? 'SPRAY' : 'PER_ML',
                unit: 'ml',
                isGroup: false,
                parentId: null,
                bottleSizeMl: null,
            }
        }

        try {
            if (form.mirrorFragrance) {
                const cats = fragranceCats()
                if (cats.length < 3) {
                    setError('Need Attar, Oud and Spray categories to mirror. Create them first.')
                    setBusy(false)
                    return
                }
                const list = asArray(products)
                // One physical stock shared by Attar + Oud + Spray
                let stockGroupId =
                    list.find(
                        (p) =>
                            (p.name || '').toLowerCase() === basePayload.name.toLowerCase() &&
                            p.stockGroupId
                    )?.stockGroupId || null
                if (!stockGroupId && typeof crypto !== 'undefined' && crypto.randomUUID) {
                    stockGroupId = crypto.randomUUID()
                } else if (!stockGroupId) {
                    stockGroupId = `sg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
                }
                let attarId = null
                for (const cat of cats) {
                    const payload = { ...payloadForCategory(cat), stockGroupId }
                    const existing = list.find(
                        (p) =>
                            p.categoryId === cat.id &&
                            (p.name || '').toLowerCase() === payload.name.toLowerCase() &&
                            !p.isGroup
                    )
                    let saved
                    if (existing) {
                        saved = await api.updateProduct(existing.id, payload)
                    } else {
                        saved = await api.createProduct(payload)
                    }
                    if ((cat.name || '').toLowerCase() === 'attar') {
                        attarId = saved?.id || existing?.id || null
                    }
                }
                // Spray recipe oil → Attar row so spray sales deduct shared oil stock
                if (attarId) {
                    const sprayCat = cats.find((c) => (c.name || '').toLowerCase() === 'spray')
                    if (sprayCat) {
                        const spray = asArray(
                            await api.getProducts({ active: 'false' })
                        ).find(
                            (p) =>
                                p.categoryId === sprayCat.id &&
                                (p.name || '').toLowerCase() === basePayload.name.toLowerCase() &&
                                !p.isGroup
                        )
                        if (spray) {
                            await api.updateProduct(spray.id, {
                                oilProductId: attarId,
                                stockGroupId,
                                stockQty: basePayload.stockQty,
                            })
                        }
                    }
                }
            } else if (editing) {
                await api.updateProduct(editing.id, basePayload)
            } else {
                await api.createProduct(basePayload)
            }

            const [p, c] = await Promise.all([
                api.getProducts({ active: 'false' }),
                api.getCategories(),
            ])
            const list = asArray(p)
            setProducts(list)
            const cats = asArray(c)
            setCategories(cats)
            await syncCache(list)
            setShowForm(false)
            setEditing(null)
            setForm(emptyForm)
        } catch (err) {
            setError(err?.message || 'Save failed')
        } finally {
            setBusy(false)
        }
    }

    const handleDelete = async () => {
        if (!deleteId) return
        setBusy(true)
        setError('')
        try {
            await api.deleteProduct(deleteId)
            const next = products.filter((p) => p.id !== deleteId)
            setProducts(next)
            await syncCache(next)
            setDeleteId(null)
        } catch (err) {
            setError(err?.message || 'Delete failed')
            setDeleteId(null)
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="p-4 max-w-3xl mx-auto pb-6">
            <div className="flex items-center justify-between mb-3">
                <div>
                    <h1 className="text-xl font-bold text-charcoal">Products</h1>
                    <p className="text-xs text-muted">
                        {catalogRows.length} items
                        {refreshing ? ' · updating…' : ''}
                    </p>
                </div>
                <button onClick={openCreate} className="btn-primary flex items-center gap-1.5 text-sm py-2 px-3">
                    <Plus size={16} /> Add
                </button>
            </div>

            <div className="mb-3 px-0 py-0">
                <div className="grid grid-cols-5 gap-1.5">
                    {(Array.isArray(categories) ? categories : []).map((cat) => {
                        const Icon = CATEGORY_ICON[cat.name] || Package
                        const active = categoryId === cat.id
                        return (
                            <button
                                key={cat.id}
                                type="button"
                                onClick={() => setCategoryId(cat.id)}
                                className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl border text-[10px] font-semibold transition-colors ${
                                    active ? 'bg-emerald text-white border-emerald' : 'bg-white text-muted border-border'
                                }`}
                            >
                                <Icon size={16} className={active ? 'text-gold' : 'text-emerald'} />
                                <span className="truncate w-full text-center">{cat.name}</span>
                            </button>
                        )
                    })}
                </div>
            </div>

            <div className="relative mb-3">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                    className="input pl-9"
                    placeholder="Search products…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            {error && (
                <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                    {error}
                </div>
            )}

            {loading ? (
                <p className="text-muted text-sm">Loading…</p>
            ) : pageRows.length === 0 ? (
                <div className="card p-8 text-center text-muted text-sm">No products found</div>
            ) : (
                <>
                    <div className="grid grid-cols-2 gap-2">
                        {pageRows.map((row) => {
                            const p = row.product
                            const qty = formatStock(p)
                            return (
                                <div
                                    key={p.id}
                                    className="self-start w-full bg-white rounded-2xl border border-[#E5E0D8] shadow-[0_1px_2px_rgba(0,0,0,0.04)] px-3 py-2.5 flex items-center gap-2 min-h-[56px]"
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="font-semibold text-[13px] text-charcoal leading-tight truncate">
                                            {p?.name || '—'}
                                            {p?.isActive === false && (
                                                <span className="ml-1 text-[10px] font-medium text-muted">· off</span>
                                            )}
                                        </div>
                                        <div className="text-[12px] text-muted mt-0.5 truncate">
                                            {qty ? `Qty ${qty}` : 'Qty —'}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => openEdit(p)}
                                        className="w-7 h-7 rounded-full bg-emerald text-white flex items-center justify-center shrink-0 active:scale-95 transition-transform"
                                        aria-label="Edit product"
                                    >
                                        <Pencil size={13} strokeWidth={2.5} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDeleteId(p.id)}
                                        className="w-7 h-7 rounded-full border border-border text-muted flex items-center justify-center shrink-0 active:bg-red-50 active:text-red-600 active:border-red-200 transition-colors"
                                        aria-label="Delete product"
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            )
                        })}
                    </div>

                    {totalPages > 1 && (
                        <div className="flex items-center justify-between mt-4 text-sm">
                            <button
                                type="button"
                                disabled={page === 0}
                                onClick={() => setPage((p) => Math.max(0, p - 1))}
                                className="flex items-center gap-1 px-3 py-2 rounded-xl border border-border disabled:opacity-40"
                            >
                                <ChevronLeft size={16} /> Prev
                            </button>
                            <span className="text-muted">
                                {page + 1} / {totalPages}
                            </span>
                            <button
                                type="button"
                                disabled={page >= totalPages - 1}
                                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                                className="flex items-center gap-1 px-3 py-2 rounded-xl border border-border disabled:opacity-40"
                            >
                                Next <ChevronRight size={16} />
                            </button>
                        </div>
                    )}
                </>
            )}

            {showForm && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
                    <form
                        onSubmit={handleSubmit}
                        className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl p-4 space-y-3.5 shadow-xl max-h-[90vh] overflow-auto"
                    >
                        <h2 className="font-bold text-lg text-charcoal">
                            {editing ? 'Edit product' : 'New product'}
                        </h2>

                        <div>
                            <label className="text-[10px] uppercase tracking-wide text-muted font-semibold mb-1 block">
                                Name
                            </label>
                            <input
                                className="input"
                                placeholder="Product name"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                required
                            />
                        </div>

                        <div>
                            <label className="text-[10px] uppercase tracking-wide text-muted font-semibold mb-1 block">
                                Category
                            </label>
                            <select
                                className="input"
                                value={form.categoryId}
                                onChange={(e) => {
                                    const id = e.target.value
                                    const name = (categories.find((c) => c.id === id)?.name || '').toLowerCase()
                                    const keepMirror = ['attar', 'oud', 'spray'].includes(name)
                                    setForm({
                                        ...form,
                                        categoryId: id,
                                        mirrorFragrance: keepMirror ? form.mirrorFragrance : false,
                                    })
                                }}
                                required
                            >
                                {categories.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-[10px] uppercase tracking-wide text-muted font-semibold mb-1 block">
                                Product type
                            </label>
                            <select
                                className="input"
                                value={form.productType}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        productType: e.target.value,
                                        unit: e.target.value === 'PER_ML' || e.target.value === 'SPRAY' ? 'ml' : 'piece',
                                        isGroup: false,
                                        parentId: '',
                                    })
                                }
                            >
                                <option value="PER_ML">Per ml (Attar/Oud/Spray)</option>
                                <option value="SPRAY">Spray (composite)</option>
                                <option value="FIXED">Fixed price</option>
                            </select>
                        </div>

                        {(() => {
                            const catName = (
                                categories.find((c) => c.id === form.categoryId)?.name || ''
                            ).toLowerCase()
                            const fragranceCat = ['attar', 'oud', 'spray'].includes(catName)
                            const fragranceType =
                                form.productType === 'PER_ML' || form.productType === 'SPRAY'
                            if (!fragranceCat || !fragranceType) return null
                            return (
                                <label className="flex items-start gap-3 rounded-xl border border-border bg-ivory/40 p-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="mt-0.5 w-4 h-4 rounded accent-emerald shrink-0"
                                        checked={Boolean(form.mirrorFragrance)}
                                        onChange={(e) =>
                                            setForm({ ...form, mirrorFragrance: e.target.checked })
                                        }
                                    />
                                    <span className="min-w-0">
                                        <span className="block text-sm font-semibold text-charcoal">
                                            Also add to Attar, Oud &amp; Spray
                                        </span>
                                        <span className="block text-[11px] text-muted mt-0.5 leading-snug">
                                            Same oil in Attar, Oud &amp; Spray — one shared stock. A sale in any section updates qty on all three.
                                        </span>
                                    </span>
                                </label>
                            )
                        })()}

                        <div className="grid grid-cols-2 gap-2.5">
                                    <div>
                                        <label className="text-[10px] uppercase tracking-wide text-muted font-semibold mb-1 block">
                                            Selling price (₹)
                                        </label>
                                        <input
                                            className="input"
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            placeholder={
                                                form.productType === 'PER_ML' || form.productType === 'SPRAY'
                                                    ? 'Per ml'
                                                    : 'Per unit'
                                            }
                                            value={form.unitPrice}
                                            onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase tracking-wide text-muted font-semibold mb-1 block">
                                            Total quantity
                                        </label>
                                        <input
                                            className="input"
                                            type="number"
                                            step={form.productType === 'PER_ML' ? '0.5' : '1'}
                                            min="0"
                                            placeholder="Stock qty"
                                            value={form.stockQty}
                                            onChange={(e) => setForm({ ...form, stockQty: e.target.value })}
                                        />
                                    </div>
                                </div>
                                {isOwner && (
                                    <div>
                                        <label className="text-[10px] uppercase tracking-wide text-muted font-semibold mb-1 block">
                                            Purchase / wholesale rate (₹) — optional
                                        </label>
                                        <input
                                            className="input"
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            placeholder={
                                                form.productType === 'PER_ML' || form.productType === 'SPRAY'
                                                    ? 'Cost per ml'
                                                    : 'Cost per unit'
                                            }
                                            value={form.purchasePrice}
                                            onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })}
                                        />
                                    </div>
                                )}
                                <div>
                                    <label className="text-[10px] uppercase tracking-wide text-muted font-semibold mb-1 block">
                                        Unit
                                    </label>
                                    <select
                                        className="input"
                                        value={form.unit === 'pcs' || form.unit === 'packet' ? 'piece' : (form.unit || 'ml')}
                                        onChange={(e) => setForm({ ...form, unit: e.target.value })}
                                    >
                                        <option value="ml">ml</option>
                                        <option value="piece">piece</option>
                                    </select>
                                </div>
                        <div className="flex gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowForm(false)
                                    setEditing(null)
                                }}
                                className="flex-1 border border-border rounded-xl py-2.5"
                            >
                                Cancel
                            </button>
                            <button type="submit" disabled={busy} className="btn-primary flex-1">
                                {busy ? 'Saving…' : 'Save'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <ConfirmModal
                open={!!deleteId}
                onClose={() => setDeleteId(null)}
                onConfirm={handleDelete}
                title="Delete product?"
                message="This permanently removes the product. If it was used on past bills, delete may be blocked."
                confirmLabel="Delete"
                danger
            />
        </div>
    )
}
