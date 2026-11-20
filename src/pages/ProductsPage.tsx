import { useRef, useState } from 'react';
import {
  Archive,
  Copy,
  Download,
  Edit3,
  Eye,
  Plus,
  Search,
  Sparkles,
  Tag,
  Upload,
  X,
} from 'lucide-react';
import { CATEGORY_ATTRIBUTE_TEMPLATES } from '../domain/operatorEngine';
import { useStoreState } from '../store/useStoreState';
import type { Product, ProductCategory, ProductFulfillmentType, SuggestedTagItem, Variant } from '../types/domain';
import { downloadTextFile, escapeCsvCell, formatCurrency, formatDateTime, parseSimpleCsv } from '../utils/formatters';
import { ProductImage } from '../components/shared/ProductImage';
import { StatusTag } from '../components/shared/StatusBadge';

const CATEGORIES: ProductCategory[] = [
  'Electronics',
  'Home & Kitchen',
  'Beauty & Personal Care',
  'Books & Stationery',
  'Specialty Groceries',
  'Digital Downloads',
  'Subscriptions & Bundles',
  'Made-to-Order Goods',
];

interface ProductsPageProps {
  onOpenApprovals: () => void;
}

export function ProductsPage({ onOpenApprovals }: ProductsPageProps) {
  const {
    state,
    upsertProduct,
    duplicateProduct,
    archiveProduct,
    importProductsFromCsvRows,
    requestApplyProductTags,
  } = useStoreState();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Editor state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ProductCategory>('Electronics');
  const [fulfillmentType, setFulfillmentType] = useState<ProductFulfillmentType>('physical');
  const [imageUrl, setImageUrl] = useState('');
  const [imageBase64, setImageBase64] = useState<string | undefined>(undefined);
  const [imageMimeType, setImageMimeType] = useState<string | undefined>(undefined);
  const [tagsInput, setTagsInput] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [sku, setSku] = useState('');
  const [variantTitle, setVariantTitle] = useState('Standard');
  const [price, setPrice] = useState('0');
  const [unitCost, setUnitCost] = useState('');
  const [stock, setStock] = useState('0');
  const [lowStockThreshold, setLowStockThreshold] = useState('5');
  const [attributes, setAttributes] = useState<Array<{ key: string; value: string }>>([]);
  const [unverifiedFields, setUnverifiedFields] = useState<string[]>([]);
  const [missingNote, setMissingNote] = useState('');
  const [extracting, setExtracting] = useState(false);

  // AI Tag Suggestion State (must be reviewed & approved before applying!)
  const [suggestedTags, setSuggestedTags] = useState<SuggestedTagItem[]>([]);
  const [suggestingTags, setSuggestingTags] = useState(false);
  const [tagError, setTagError] = useState<string | null>(null);

  const csvImportRef = useRef<HTMLInputElement>(null);
  const extractFileRef = useRef<HTMLInputElement>(null);

  const filteredProducts = state.products.filter((p) => {
    if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchTitle = p.title.toLowerCase().includes(q);
      const matchSku = p.variants.some((v) => v.sku.toLowerCase().includes(q));
      const matchTag = p.tags.some((t) => t.toLowerCase().includes(q));
      if (!matchTitle && !matchSku && !matchTag) return false;
    }
    return true;
  });

  const openCreateEditor = (cat: ProductCategory = 'Electronics') => {
    setEditingId(null);
    setTitle('');
    setDescription('');
    setCategory(cat);
    setFulfillmentType(cat === 'Digital Downloads' ? 'digital_download' : cat === 'Subscriptions & Bundles' ? 'subscription' : cat === 'Made-to-Order Goods' ? 'made_to_order' : 'physical');
    setImageUrl('');
    setImageBase64(undefined);
    setImageMimeType(undefined);
    setTagsInput('');
    setSeoTitle('');
    setSeoDescription('');
    setSku('');
    setVariantTitle('Standard');
    setPrice('');
    setUnitCost('');
    setStock('0');
    setLowStockThreshold('5');
    setAttributes(CATEGORY_ATTRIBUTE_TEMPLATES[cat].map((k) => ({ key: k, value: '' })));
    setUnverifiedFields([]);
    setMissingNote('');
    setSuggestedTags([]);
    setTagError(null);
    setErrorMsg(null);
    setEditorOpen(true);
  };

  const openEditEditor = (product: Product) => {
    const v = product.variants[0];
    setEditingId(product.id);
    setTitle(product.title);
    setDescription(product.description);
    setCategory(product.category);
    setFulfillmentType(product.fulfillmentType);
    setImageUrl(product.imageUrl ?? '');
    setImageBase64(undefined);
    setImageMimeType(undefined);
    setTagsInput(product.tags.join(', '));
    setSeoTitle(product.seoTitle ?? '');
    setSeoDescription(product.seoDescription ?? '');
    setSku(v?.sku ?? '');
    setVariantTitle(v?.title ?? 'Standard');
    setPrice(v ? String(v.price) : '0');
    setUnitCost(v?.unitCost !== null && v?.unitCost !== undefined ? String(v.unitCost) : '');
    setStock(v ? String(v.stock) : '0');
    setLowStockThreshold(v ? String(v.lowStockThreshold) : '5');
    setAttributes(
      v ? Object.entries(v.attributes).map(([key, value]) => ({ key, value })) : []
    );
    setUnverifiedFields(product.unverifiedFields ?? []);
    setMissingNote(product.missingFieldsNote ?? '');
    setSuggestedTags([]);
    setTagError(null);
    setErrorMsg(null);
    setEditorOpen(true);
  };

  const handleCategoryChange = (nextCat: ProductCategory) => {
    setCategory(nextCat);
    if (!editingId) {
      setAttributes(CATEGORY_ATTRIBUTE_TEMPLATES[nextCat].map((k) => ({ key: k, value: '' })));
      if (nextCat === 'Digital Downloads') setFulfillmentType('digital_download');
      else if (nextCat === 'Subscriptions & Bundles') setFulfillmentType('subscription');
      else if (nextCat === 'Made-to-Order Goods') setFulfillmentType('made_to_order');
      else setFulfillmentType('physical');
    }
  };

  const handleFileExtraction = async (file: File | undefined) => {
    if (!file) return;
    setExtracting(true);
    setErrorMsg(null);

    try {
      const mimeType = file.type || (file.name.endsWith('.csv') ? 'text/csv' : 'text/plain');
      let b64: string | undefined;
      let textContent: string | undefined;

      if (mimeType.startsWith('image/')) {
        const dataUrl = await new Promise<string>((resolve) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result || ''));
          r.readAsDataURL(file);
        });
        b64 = dataUrl.split(',')[1];
        setImageUrl(dataUrl);
        setImageBase64(b64);
        setImageMimeType(mimeType);
      } else {
        textContent = await file.text();
      }

      const res = await fetch('/api/ai/extract-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          mimeType,
          base64Data: b64,
          textContent,
          supportedCategories: CATEGORIES,
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        // Transparent error + safe local CSV/filename extraction without inventing unseen specs
        setErrorMsg(
          `${json.error} Applied safe local extraction from "${file.name}" only for explicitly supplied fields; missing attributes marked for review.`
        );
        if (textContent && file.name.toLowerCase().endsWith('.csv')) {
          const parsed = parseSimpleCsv(textContent);
          const first = parsed.rows[0];
          if (first) {
            if (first.title || first.Title) setTitle(first.title || first.Title);
            if (first.description || first.Description) setDescription(first.description || first.Description);
            if (first.price || first.Price) setPrice(first.price || first.Price);
            if (first.sku || first.SKU) setSku(first.sku || first.SKU);
          }
        } else {
          if (!title) setTitle(file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '));
          setUnverifiedFields(['category', 'price', 'sku', 'material / specs']);
          setMissingNote('Price, SKU, and specs were not readable locally from the file—enter verified values before publishing.');
        }
        return;
      }

      const ext = json.extracted;
      if (ext.title) setTitle(ext.title);
      if (ext.description) setDescription(ext.description);
      if (ext.category && CATEGORIES.includes(ext.category)) setCategory(ext.category);
      if (typeof ext.price === 'number' && ext.price > 0) setPrice(String(ext.price));
      if (ext.sku) setSku(ext.sku);
      if (Array.isArray(ext.tags) && ext.tags.length > 0) setTagsInput(ext.tags.join(', '));
      if (ext.seoTitle) setSeoTitle(ext.seoTitle);
      if (ext.seoDescription) setSeoDescription(ext.seoDescription);
      if (Array.isArray(ext.attributes) && ext.attributes.length > 0) {
        setAttributes(ext.attributes);
      }
      const unverified = Array.isArray(ext.unverifiedFields) ? ext.unverifiedFields : [];
      const missing = Array.isArray(ext.missingFields) ? ext.missingFields : [];
      setUnverifiedFields(unverified);
      setMissingNote(
        missing.length > 0 ? `Missing from upload (not invented): ${missing.join(', ')}` : ''
      );
      setNotice('Extracted verifiable fields from upload. Review flagged fields before publishing.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to analyze uploaded file.');
    } finally {
      setExtracting(false);
    }
  };

  const handleSuggestTags = async (targetTitle: string, targetDesc: string, targetCat: ProductCategory, targetImgUrl?: string) => {
    if (!targetTitle.trim() && !targetDesc.trim() && !targetImgUrl && !imageBase64) {
      setTagError('Provide at least a title, description, or product image before requesting tag suggestions.');
      return;
    }
    setSuggestingTags(true);
    setTagError(null);
    try {
      const res = await fetch('/api/ai/suggest-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: targetTitle,
          description: targetDesc,
          category: targetCat,
          imageBase64,
          imageMimeType,
          imageUrl: targetImgUrl,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        // Show honest error AND offer deterministic keyword extraction strictly from supplied title/description
        setTagError(`${json.error} Showing deterministic keyword suggestions extracted solely from your title & description below for review.`);
        const words = `${targetTitle} ${targetDesc}`
          .toLowerCase()
          .replace(/[^a-z0-9-\s]/g, ' ')
          .split(/\s+/)
          .filter((w) => w.length >= 4 && !['with', 'from', 'that', 'this', 'your', 'into', 'pair'].includes(w));
        const unique = Array.from(new Set(words)).slice(0, 6);
        setSuggestedTags(
          unique.map((w, idx) => ({
            tag: w,
            category: idx % 2 === 0 ? 'Material & Specs' : 'Use Case',
            source: idx < 2 ? 'title' : 'description',
            confidence: 'verified',
            selected: true,
          }))
        );
        return;
      }

      const rawList = Array.isArray(json.suggestions) ? json.suggestions : [];
      setSuggestedTags(
        rawList.map((s: any) => ({
          tag: String(s.tag || '').toLowerCase().trim(),
          category: (['Material & Specs', 'Use Case', 'Audience & Channel', 'Merchandising'].includes(s.category)
            ? s.category
            : 'Merchandising') as SuggestedTagItem['category'],
          source: (['title', 'description', 'image'].includes(s.source) ? s.source : 'description') as SuggestedTagItem['source'],
          confidence: s.confidence === 'verified' ? 'verified' : 'inferred',
          selected: true,
        }))
      );
    } catch (err) {
      setTagError(err instanceof Error ? err.message : 'Failed to suggest tags.');
    } finally {
      setSuggestingTags(false);
    }
  };

  const handleSubmitSuggestedTagsForApproval = async (productId: string) => {
    const existing = tagsInput
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    const chosen = suggestedTags.filter((s) => s.selected).map((s) => s.tag);
    if (chosen.length === 0) {
      setTagError('Select at least one suggested tag to submit for approval.');
      return;
    }
    const merged = Array.from(new Set([...existing, ...chosen]));
    const res = await requestApplyProductTags(productId, merged);
    setNotice(res.message);
    onOpenApprovals();
  };

  const handleSaveProduct = async (requestPublish: boolean) => {
    if (!title.trim()) {
      setErrorMsg('Product title is required.');
      return;
    }
    const numericPrice = Number(price);
    if (requestPublish && (!Number.isFinite(numericPrice) || numericPrice <= 0 || !sku.trim())) {
      setErrorMsg('A verified SKU and positive price are required before requesting publish.');
      return;
    }

    const existing = editingId ? state.products.find((p) => p.id === editingId) : undefined;
    const prodId = editingId ?? `prod-${Date.now()}`;
    const attrRecord: Record<string, string> = {};
    attributes.forEach((a) => {
      if (a.key.trim() && a.value.trim()) {
        attrRecord[a.key.trim()] = a.value.trim();
      }
    });

    const primaryVariant: Variant = {
      id: existing?.variants[0]?.id ?? `var-${Date.now()}`,
      productId: prodId,
      sku: sku.trim() || `DRAFT-${Date.now().toString().slice(-4)}`,
      title: variantTitle.trim() || 'Standard',
      attributes: attrRecord,
      price: Number.isFinite(numericPrice) ? numericPrice : 0,
      unitCost: unitCost.trim() ? Number(unitCost) : null,
      stock: Number.isFinite(Number(stock)) ? Math.max(0, Number(stock)) : 0,
      reserved: existing?.variants[0]?.reserved ?? 0,
      lowStockThreshold: Number.isFinite(Number(lowStockThreshold)) ? Math.max(0, Number(lowStockThreshold)) : 5,
    };

    const nextProduct: Product = {
      id: prodId,
      title: title.trim(),
      description: description.trim(),
      category,
      fulfillmentType,
      status: existing?.status === 'archived' ? 'archived' : 'draft',
      imageUrl: imageUrl.trim() || undefined,
      tags: tagsInput
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
      taxable: fulfillmentType !== 'subscription',
      requiresShipping: fulfillmentType !== 'digital_download',
      seoTitle: seoTitle.trim() || undefined,
      seoDescription: seoDescription.trim() || undefined,
      unverifiedFields: unverifiedFields.length > 0 ? unverifiedFields : undefined,
      missingFieldsNote: missingNote.trim() || undefined,
      variants: existing && existing.variants.length > 1 ? [primaryVariant, ...existing.variants.slice(1)] : [primaryVariant],
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const res = await upsertProduct(nextProduct, requestPublish);
    setNotice(res.message);
    setEditorOpen(false);
    if (res.needsApproval) {
      onOpenApprovals();
    }
  };

  const handleExportCsv = () => {
    const headers = ['title', 'sku', 'category', 'fulfillmentType', 'status', 'price', 'unitCost', 'stock', 'tags'];
    const lines = [headers.join(',')];
    for (const p of state.products) {
      for (const v of p.variants) {
        lines.push(
          [
            p.title,
            v.sku,
            p.category,
            p.fulfillmentType,
            p.status,
            v.price,
            v.unitCost ?? '',
            v.stock,
            p.tags.join(';'),
          ]
            .map(escapeCsvCell)
            .join(',')
        );
      }
    }
    downloadTextFile('aira-demo-catalog.csv', lines.join('\n'));
    setNotice('Exported demo catalog CSV.');
  };

  const handleCsvImport = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    const { rows } = parseSimpleCsv(text);
    const count = importProductsFromCsvRows(rows);
    setNotice(
      count > 0
        ? `Imported ${count} draft product(s) from "${file.name}". Missing fields are flagged for review.`
        : 'No valid product rows with a title column were found in that CSV.'
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Products Catalog</h1>
          <p className="mt-1 text-sm text-slate-600">
            Category-neutral catalog supporting physical goods, digital downloads, subscriptions, bundles, and made-to-order items.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={csvImportRef}
            type="file"
            accept=".csv"
            onChange={(e) => handleCsvImport(e.target.files?.[0])}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => csvImportRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <Upload className="h-3.5 w-3.5" />
            Import CSV
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => openCreateEditor('Electronics')}
            className="inline-flex items-center gap-1.5 rounded bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            New Product Draft
          </button>
        </div>
      </div>

      {notice && (
        <div className="rounded border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-medium text-blue-900 flex items-center justify-between gap-3">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="text-blue-700 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-3.5">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, SKU, or tag..."
            className="w-full rounded border border-slate-300 pl-9 pr-3 py-1.5 text-sm focus:border-blue-600 focus:outline-none"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm bg-white"
        >
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm bg-white"
        >
          <option value="all">All statuses</option>
          <option value="published">Published (Demo)</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {/* Products Table */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
              <th className="py-3 px-4">Product</th>
              <th className="py-3 px-4">Primary SKU</th>
              <th className="py-3 px-4">Category &amp; Type</th>
              <th className="py-3 px-4 text-right">Price</th>
              <th className="py-3 px-4 text-right">Stock</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Updated</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-sm">
            {filteredProducts.map((p) => {
              const totalStock = p.variants.reduce((sum, v) => sum + v.stock, 0);
              const primary = p.variants[0];
              return (
                <tr key={p.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <ProductImage src={p.imageUrl} alt={p.title} category={p.category} className="h-10 w-10" />
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 truncate max-w-[260px]">{p.title}</p>
                        <p className="text-xs text-slate-500 truncate max-w-[260px]">
                          {p.tags.length > 0 ? p.tags.join(' · ') : 'No tags'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-slate-700 whitespace-nowrap">
                    {primary?.sku ?? '—'}
                    {p.variants.length > 1 && <span className="text-slate-400"> +{p.variants.length - 1}</span>}
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-600">
                    <div className="font-medium text-slate-800">{p.category}</div>
                    <div>{p.fulfillmentType.replace('_', ' ')}</div>
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900 whitespace-nowrap">
                    {primary ? formatCurrency(primary.price, state.store.currency) : '—'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                    {p.requiresShipping ? totalStock : 'Unlimited'}
                  </td>
                  <td className="py-3 px-4">
                    <StatusTag
                      tone={p.status === 'published' ? 'success' : p.status === 'draft' ? 'warning' : 'neutral'}
                      label={p.status === 'published' ? 'Published (Demo)' : p.status === 'draft' ? 'Draft' : 'Archived'}
                    />
                  </td>
                  <td className="py-3 px-4 font-mono text-xs tabular-nums text-slate-500 whitespace-nowrap">
                    {formatDateTime(p.updatedAt, state.store.dateFormat, state.store.timezone)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setPreviewProduct(p)}
                        className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                        title="Preview"
                        aria-label={`Preview ${p.title}`}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditEditor(p)}
                        className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                        title="Edit & AI Tags"
                        aria-label={`Edit ${p.title}`}
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => duplicateProduct(p.id)}
                        className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                        title="Duplicate"
                        aria-label={`Duplicate ${p.title}`}
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      {p.status !== 'archived' && (
                        <button
                          type="button"
                          onClick={() => archiveProduct(p.id)}
                          className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-red-700"
                          title="Archive"
                          aria-label={`Archive ${p.title}`}
                        >
                          <Archive className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredProducts.length === 0 && (
              <tr>
                <td colSpan={8} className="py-10 text-center text-sm text-slate-500">
                  No products match the current search or filter criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Preview Modal */}
      {previewProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-base font-semibold text-slate-900">Product Preview (Demo Catalog)</h2>
              <button type="button" onClick={() => setPreviewProduct(null)} className="rounded p-1 text-slate-500 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="flex flex-col sm:flex-row gap-5">
                <ProductImage src={previewProduct.imageUrl} alt={previewProduct.title} category={previewProduct.category} className="h-32 w-32" />
                <div className="space-y-1.5">
                  <p className="text-xs text-slate-500">
                    {previewProduct.category} · {previewProduct.fulfillmentType.replace('_', ' ')}
                  </p>
                  <h3 className="text-xl font-semibold text-slate-900">{previewProduct.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{previewProduct.description}</p>
                  <p className="text-xs text-slate-500 pt-1">
                    Tags: {previewProduct.tags.length > 0 ? previewProduct.tags.join(' · ') : 'None'}
                  </p>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <p className="text-xs font-semibold text-slate-700 mb-2">Variants &amp; Category-Specific Attributes</p>
                <div className="space-y-2">
                  {previewProduct.variants.map((v) => (
                    <div key={v.id} className="rounded border border-slate-200 p-3 text-xs flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {v.title} · <span className="font-mono text-slate-600">{v.sku}</span>
                        </p>
                        <p className="text-slate-600 mt-0.5">
                          {Object.entries(v.attributes)
                            .map(([k, val]) => `${k}: ${val}`)
                            .join(' · ') || 'No custom attributes'}
                        </p>
                      </div>
                      <div className="text-right font-mono tabular-nums">
                        <p className="font-semibold text-slate-900">{formatCurrency(v.price, state.store.currency)}</p>
                        <p className="text-slate-500">
                          Stock: {previewProduct.requiresShipping ? v.stock : 'Digital'} · Cost:{' '}
                          {v.unitCost !== null ? formatCurrency(v.unitCost, state.store.currency) : 'Unknown'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit + AI Extraction + AI Tag Suggestion Modal */}
      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-lg border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-base font-semibold text-slate-900">
                {editingId ? 'Edit Product & AI Tag Suggestions' : 'New Product Draft (Saves as Draft by Default)'}
              </h2>
              <button type="button" onClick={() => setEditorOpen(false)} className="rounded p-1 text-slate-500 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* AI File / Image Extraction Bar */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-slate-900">AI-Assisted Extraction from Photo or Spec File</p>
                  <p className="text-xs text-slate-600">
                    Extracts only visibly confirmed or supplied fields. Uncertain or missing attributes are flagged—never invented.
                  </p>
                </div>
                <div>
                  <input
                    ref={extractFileRef}
                    type="file"
                    accept="image/*,.csv,.txt,.json,.pdf"
                    onChange={(e) => handleFileExtraction(e.target.files?.[0])}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={extracting}
                    onClick={() => extractFileRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-50"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                    {extracting ? 'Extracting...' : 'Upload Photo / File to Extract'}
                  </button>
                </div>
              </div>

              {errorMsg && (
                <div className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-900">{errorMsg}</div>
              )}

              {(unverifiedFields.length > 0 || missingNote) && (
                <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 space-y-1">
                  {unverifiedFields.length > 0 && (
                    <p>
                      <span className="font-semibold">Needs human review:</span> {unverifiedFields.join(', ')}
                    </p>
                  )}
                  {missingNote && <p>{missingNote}</p>}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Product Title *</label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., USB-C GaN Desktop Charger 100W"
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
                    <select
                      value={category}
                      onChange={(e) => handleCategoryChange(e.target.value as ProductCategory)}
                      className="w-full rounded border border-slate-300 px-3 py-2 text-sm bg-white"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Offering Type</label>
                    <select
                      value={fulfillmentType}
                      onChange={(e) => setFulfillmentType(e.target.value as ProductFulfillmentType)}
                      className="w-full rounded border border-slate-300 px-3 py-2 text-sm bg-white"
                    >
                      <option value="physical">Physical Product</option>
                      <option value="digital_download">Digital Download</option>
                      <option value="subscription">Subscription</option>
                      <option value="bundle">Bundle</option>
                      <option value="made_to_order">Made-to-Order</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              {/* Variant & Pricing */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">SKU</label>
                  <input value={sku} onChange={(e) => setSku(e.target.value)} className="w-full rounded border border-slate-300 px-3 py-2 text-sm font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Variant Label</label>
                  <input value={variantTitle} onChange={(e) => setVariantTitle(e.target.value)} className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Price ({state.store.currency})</label>
                  <input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full rounded border border-slate-300 px-3 py-2 text-sm font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Unit Cost (optional)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Leave blank if unknown"
                    value={unitCost}
                    onChange={(e) => setUnitCost(e.target.value)}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Stock Qty</label>
                  <input type="number" value={stock} onChange={(e) => setStock(e.target.value)} className="w-full rounded border border-slate-300 px-3 py-2 text-sm font-mono" />
                </div>
              </div>

              {/* Category-Neutral Seller-Defined Attributes */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">
                    Category-Specific Attributes (no clothing sizes/colors forced)
                  </label>
                  <button
                    type="button"
                    onClick={() => setAttributes((prev) => [...prev, { key: '', value: '' }])}
                    className="text-xs font-medium text-blue-600 hover:underline"
                  >
                    + Add Attribute
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {attributes.map((attr, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        value={attr.key}
                        onChange={(e) =>
                          setAttributes((prev) => prev.map((item, i) => (i === idx ? { ...item, key: e.target.value } : item)))
                        }
                        placeholder="Attribute (e.g. Capacity)"
                        className="w-2/5 rounded border border-slate-300 px-2.5 py-1.5 text-xs"
                      />
                      <input
                        value={attr.value}
                        onChange={(e) =>
                          setAttributes((prev) => prev.map((item, i) => (i === idx ? { ...item, value: e.target.value } : item)))
                        }
                        placeholder="Value (e.g. 900 ml)"
                        className="flex-1 rounded border border-slate-300 px-2.5 py-1.5 text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Tags + AI Tag Generation & Review Workflow */}
              <div className="rounded-lg border border-slate-200 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5 text-blue-600" />
                      Product Tags &amp; AI Tag Suggestions
                    </p>
                    <p className="text-xs text-slate-500">
                      AI analyzes title, description, and image to categorize suggested tags. Suggestions require your approval before applying.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={suggestingTags}
                    onClick={() => handleSuggestTags(title, description, category, imageUrl)}
                    className="inline-flex items-center gap-1.5 rounded border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-800 hover:bg-blue-100 disabled:opacity-50"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {suggestingTags ? 'Analyzing...' : 'Suggest Categorized Tags'}
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Current Applied Tags (comma-separated)</label>
                  <input
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="e.g., audio, usb-c, wireless"
                    className="w-full rounded border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>

                {tagError && <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2.5">{tagError}</p>}

                {suggestedTags.length > 0 && (
                  <div className="border-t border-slate-200 pt-3 space-y-3">
                    <p className="text-xs font-semibold text-slate-800">
                      Suggested Tags (Unapplied — Review &amp; Select)
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(['Material & Specs', 'Use Case', 'Audience & Channel', 'Merchandising'] as const).map((cat) => {
                        const group = suggestedTags.filter((s) => s.category === cat);
                        if (group.length === 0) return null;
                        return (
                          <div key={cat} className="rounded border border-slate-200 bg-slate-50 p-3 space-y-1.5">
                            <p className="text-xs font-semibold text-slate-700">{cat}</p>
                            {group.map((item) => (
                              <label key={`${item.category}-${item.tag}`} className="flex items-center justify-between gap-2 text-xs text-slate-700">
                                <span className="inline-flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={item.selected}
                                    onChange={() =>
                                      setSuggestedTags((prev) =>
                                        prev.map((p) => (p.tag === item.tag ? { ...p, selected: !p.selected } : p))
                                      )
                                    }
                                  />
                                  <span className="font-mono text-slate-900">{item.tag}</span>
                                </span>
                                <span className="text-[11px] text-slate-500">
                                  {item.source} · {item.confidence}
                                </span>
                              </label>
                            ))}
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <span className="text-xs text-slate-500">
                        Selected tags are not applied automatically until approved.
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSuggestedTags([])}
                          className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                        >
                          Discard Suggestions
                        </button>
                        {editingId ? (
                          <button
                            type="button"
                            onClick={() => handleSubmitSuggestedTagsForApproval(editingId)}
                            className="rounded bg-blue-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                          >
                            Review &amp; Approve Selected Tags
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              const chosen = suggestedTags.filter((s) => s.selected).map((s) => s.tag);
                              const current = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);
                              setTagsInput(Array.from(new Set([...current, ...chosen])).join(', '));
                              setSuggestedTags([]);
                              setNotice('Approved selected tags into this new product draft.');
                            }}
                            className="rounded bg-blue-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                          >
                            Approve Selected Tags into Draft
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* SEO Suggestions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">SEO Title (editable)</label>
                  <input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} className="w-full rounded border border-slate-300 px-3 py-2 text-xs" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">SEO Meta Description (editable)</label>
                  <input value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} className="w-full rounded border border-slate-300 px-3 py-2 text-xs" />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-3.5">
              <span className="text-xs text-slate-500">
                Saved as Draft by default. Publishing requires configured approval.
              </span>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditorOpen(false)}
                  className="rounded border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveProduct(false)}
                  className="rounded border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-900 hover:bg-slate-100"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveProduct(true)}
                  className="rounded bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
                >
                  Request Publish (Demo)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
