import { useState, useEffect } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import {
  IconTicket,
  IconX,
  IconBox,
  IconPlus,
  IconCheck,
  IconTrash,
  IconSearch,
} from '../../components/shared/icons';
import { ModalOverlay } from '../../components/shared/ModalOverlay';
import type { PackageData } from '../../data/packages';
import { supabase } from '../../lib/supabase';

const inputClass =
  'w-full rounded-full border px-4 py-2.5 text-xs bg-[#EEEEEE] text-[var(--ink)] placeholder:text-[#24252c]/40 focus:outline-none focus:border-[#1090F8] border-transparent transition-colors';

export interface DatabaseEquipmentItem {
  id: string;
  model_id: string;
  name: string;
  category: string;
  availableUnits: number;
}

interface GalleryPhoto {
  url: string;
  label: string;
  file?: File;
  previewUrl?: string;
}

export default function AdminPackagesPage({ go: _go }: { go: (p: Page) => void }) {
  const [packages, setPackages] = useState<PackageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Equipment Models fetched from Database
  const [equipmentList, setEquipmentList] = useState<DatabaseEquipmentItem[]>([]);
  const [selectedCategoryTab, setSelectedCategoryTab] = useState('All');

  // Modals State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPkg, setEditingPkg] = useState<PackageData | null>(null);
  const [deleteConfirmPkg, setDeleteConfirmPkg] = useState<PackageData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields State
  const [pkgName, setPkgName] = useState('');
  const [pkgTag, setPkgTag] = useState('');
  const [pkgPriceDigits, setPkgPriceDigits] = useState(''); // Digits only
  const [pkgDesc, setPkgDesc] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string>('');
  const [galleryPhotos, setGalleryPhotos] = useState<GalleryPhoto[]>([]);
  const [pkgRecommendedFor, setPkgRecommendedFor] = useState('');
  const [setupTimeDigits, setSetupTimeDigits] = useState(''); // Digits only (Hours outside)
  const [crewSizeDigits, setCrewSizeDigits] = useState(''); // Digits only (Technicians outside)

  // Inventory Selection & Qty Mapping ({ [modelId]: { checked: boolean; qty: number } })
  const [selectedItems, setSelectedItems] = useState<{ [modelId: string]: { checked: boolean; qty: number } }>({});

  // Validation Error State
  const [formError, setFormError] = useState('');

  // =========================================================================
  // SUPABASE READ (PACKAGES & REAL INVENTORY EQUIPMENT MODELS)
  // =========================================================================
  const fetchPackages = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('packages')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        const formatted: PackageData[] = data.map((item: any) => ({
          id: item.package_id || item.id,
          name: item.name,
          tag: item.tag || '',
          price: item.price,
          rawPrice: Number(item.raw_price) || parseInt((item.price || '').replace(/\D/g, '')) || 0,
          desc: item.description || '',
          img: item.img || '',
          photos: item.photos || [],
          inclusions: item.inclusions || [],
          recommendedFor: item.recommended_for || [],
          specs: item.specs || {
            powerReq: '',
            setupTime: '',
            crewSize: '',
          },
        }));
        setPackages(formatted);
      } else {
        setPackages([]);
      }
    } catch (err) {
      console.warn('Supabase packages fetch note:', err);
      setPackages([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchEquipmentModelsFromDB = async () => {
    try {
      const { data, error } = await supabase
        .from('equipment_models')
        .select('*, units:physical_units(*)');

      if (error) throw error;

      if (data && data.length > 0) {
        const formatted: DatabaseEquipmentItem[] = data.map((m: any) => {
          const units = m.units || [];
          const avail = units.filter(
            (u: any) => u.status === 'Available in Warehouse' || !u.status
          ).length;

          return {
            id: m.model_id || m.id,
            model_id: m.model_id,
            name: `${m.brand && m.brand !== 'BINHI Standard' ? m.brand + ' ' : ''}${m.name}`,
            category: m.category || 'General',
            availableUnits: avail > 0 ? avail : units.length,
          };
        });
        setEquipmentList(formatted);
      } else {
        setEquipmentList([]);
      }
    } catch (err) {
      console.warn('Equipment models fetch note:', err);
      setEquipmentList([]);
    }
  };

  useEffect(() => {
    fetchPackages();
    fetchEquipmentModelsFromDB();
  }, []);

  // Unique categories list from DB equipment models
  const uniqueCategories = [
    'All',
    ...Array.from(new Set(equipmentList.map((e) => e.category))),
  ];

  // =========================================================================
  // SUPABASE STORAGE HELPERS (UPLOAD & DELETE IMAGES)
  // =========================================================================
  const uploadImageToSupabase = async (file: File): Promise<string> => {
    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `pkg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
      const filePath = `packages/${fileName}`;

      let bucketName = 'package-images';
      let { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        bucketName = 'equipment-images';
        const fallbackRes = await supabase.storage
          .from(bucketName)
          .upload(filePath, file, { upsert: true });
        if (fallbackRes.error) {
          console.warn('Supabase upload warning:', fallbackRes.error);
          return '';
        }
      }

      const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath);
      return data?.publicUrl || '';
    } catch (err) {
      console.error('Package storage upload error:', err);
      return '';
    }
  };

  const logAuditToSupabase = async (action: string, targetId: string, details: string) => {
    try {
      await supabase.from('audit_logs').insert({
        action,
        module: 'packages',
        target_id: targetId,
        details,
        user_role: 'system_admin',
      });
    } catch (err) {
      console.warn('Audit log insert note:', err);
    }
  };

  // =========================================================================
  // COVER IMAGE & GALLERY HANDLERS
  // =========================================================================
  const handleCoverFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFormError('Please select a valid image file (JPEG, PNG, WEBP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFormError('Image file size must be less than 5MB.');
      return;
    }

    setFormError('');
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const handleAddGalleryPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newPhotos: GalleryPhoto[] = [];
    Array.from(files).forEach((file) => {
      if (file.type.startsWith('image/') && file.size <= 5 * 1024 * 1024) {
        newPhotos.push({
          url: '',
          label: file.name.replace(/\.[^/.]+$/, ''),
          file,
          previewUrl: URL.createObjectURL(file),
        });
      }
    });

    setGalleryPhotos((prev) => [...prev, ...newPhotos]);
    e.target.value = '';
  };

  const handleRemoveGalleryPhoto = (index: number) => {
    setGalleryPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateGalleryLabel = (index: number, label: string) => {
    setGalleryPhotos((prev) =>
      prev.map((photo, i) => (i === index ? { ...photo, label } : photo))
    );
  };

  // =========================================================================
  // QUANTITY CHECKER & INCLUSION MAPPING (CAPPED BY DATABASE STOCK LIMIT)
  // =========================================================================
  const toggleItemCheck = (itemId: string) => {
    setSelectedItems((prev) => {
      const current = prev[itemId] || { checked: false, qty: 1 };
      return {
        ...prev,
        [itemId]: { ...current, checked: !current.checked },
      };
    });
  };

  const updateItemQty = (itemId: string, delta: number, maxAvailable: number = 999) => {
    setSelectedItems((prev) => {
      const current = prev[itemId] || { checked: true, qty: 1 };
      const maxStock = maxAvailable > 0 ? maxAvailable : 1;
      const newQty = Math.min(maxStock, Math.max(1, current.qty + delta));
      return {
        ...prev,
        [itemId]: { ...current, qty: newQty },
      };
    });
  };

  const totalSelectedCount = Object.values(selectedItems).filter((item) => item.checked).length;
  const totalUnitsMapped = Object.values(selectedItems)
    .filter((item) => item.checked)
    .reduce((sum, item) => sum + item.qty, 0);

  const generateInclusionsList = (): string[] => {
    const mapped: string[] = [];
    equipmentList.forEach((eq) => {
      const itemState = selectedItems[eq.model_id] || selectedItems[eq.id];
      if (itemState && itemState.checked) {
        mapped.push(`${itemState.qty}x ${eq.name}`);
      }
    });

    if (crewSizeDigits) {
      mapped.push(`Full Load-in, Technical Crew (${crewSizeDigits} Technicians) & On-site Soundcheck`);
    }
    return mapped;
  };

  // Filtered Equipment List by Category Tab
  const filteredEquipmentList = equipmentList.filter(
    (eq) => selectedCategoryTab === 'All' || eq.category === selectedCategoryTab
  );

  // Group Filtered Equipment by Category for Separators
  const groupedEquipment: { [category: string]: DatabaseEquipmentItem[] } = {};
  filteredEquipmentList.forEach((eq) => {
    const cat = eq.category || 'General';
    if (!groupedEquipment[cat]) {
      groupedEquipment[cat] = [];
    }
    groupedEquipment[cat].push(eq);
  });

  // =========================================================================
  // MODAL OPEN HANDLERS
  // =========================================================================
  const handleOpenEditModal = (pkg: PackageData) => {
    setEditingPkg(pkg);
    setFormError('');
    setPkgName(pkg.name);
    setPkgTag(pkg.tag || '');

    const digitsOnlyRate = (pkg.price || '').replace(/\D/g, '');
    setPkgPriceDigits(digitsOnlyRate);

    setPkgDesc(pkg.desc || '');
    setCoverFile(null);
    setCoverPreview(pkg.img || '');

    const gallery = (pkg.photos || []).map((p) => ({
      url: p.url,
      label: p.label || '',
      previewUrl: p.url,
    }));
    setGalleryPhotos(gallery);

    setPkgRecommendedFor(pkg.recommendedFor ? pkg.recommendedFor.join(', ') : '');

    const setupMatch = (pkg.specs?.setupTime || '').match(/[\d.]+/);
    setSetupTimeDigits(setupMatch ? setupMatch[0] : '');

    const crewMatch = (pkg.specs?.crewSize || '').match(/\d+/);
    setCrewSizeDigits(crewMatch ? crewMatch[0] : '');

    const initialMap: { [itemId: string]: { checked: boolean; qty: number } } = {};
    equipmentList.forEach((eq) => {
      const maxStock = eq.availableUnits > 0 ? eq.availableUnits : 1;
      const matchedInclusion = (pkg.inclusions || []).find((inc) =>
        inc.toLowerCase().includes(eq.name.toLowerCase().split(' ')[0])
      );
      if (matchedInclusion) {
        const qtyMatch = matchedInclusion.match(/^(\d+)x/);
        const parsedQty = qtyMatch ? parseInt(qtyMatch[1]) : 1;
        const qty = Math.min(maxStock, Math.max(1, parsedQty));
        initialMap[eq.model_id] = { checked: true, qty };
      } else {
        initialMap[eq.model_id] = { checked: false, qty: 1 };
      }
    });
    setSelectedItems(initialMap);
  };

  const handleOpenCreateModal = () => {
    setEditingPkg(null);
    setFormError('');
    setPkgName('');
    setPkgTag('');
    setPkgPriceDigits('');
    setPkgDesc('');
    setCoverFile(null);
    setCoverPreview('');
    setGalleryPhotos([]);
    setPkgRecommendedFor('');
    setSetupTimeDigits('');
    setCrewSizeDigits('');
    setSelectedItems({});
    setSelectedCategoryTab('All');
    setShowCreateModal(true);
  };

  // =========================================================================
  // SAVE / CREATE / UPDATE PACKAGE (WITH SUPABASE DB & STORAGE)
  // =========================================================================
  const handleSavePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    // 1. FORM VALIDATIONS
    if (!pkgName.trim()) {
      setFormError('Package Title / Name is required.');
      return;
    }

    const numericPrice = parseInt(pkgPriceDigits) || 0;
    if (numericPrice <= 0) {
      setFormError('Please enter a valid numeric rate for Daily Package Rate.');
      return;
    }

    const formattedPrice = `₱${numericPrice.toLocaleString()}`;

    const recommendedList = pkgRecommendedFor
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (totalSelectedCount === 0 && equipmentList.length > 0) {
      setFormError('Please check and map at least one inventory equipment model.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 2. COVER IMAGE UPLOAD
      let finalCoverUrl = coverPreview;
      if (coverFile) {
        const uploadedCoverUrl = await uploadImageToSupabase(coverFile);
        if (uploadedCoverUrl) {
          finalCoverUrl = uploadedCoverUrl;
        }
      }

      // 3. GALLERY PHOTOS UPLOAD
      const finalPhotos: { url: string; label: string }[] = [];
      for (const item of galleryPhotos) {
        if (item.file) {
          const uploadedGalleryUrl = await uploadImageToSupabase(item.file);
          if (uploadedGalleryUrl) {
            finalPhotos.push({ url: uploadedGalleryUrl, label: item.label || 'Event Photo' });
          } else if (item.previewUrl && !item.previewUrl.startsWith('blob:')) {
            finalPhotos.push({ url: item.previewUrl, label: item.label });
          }
        } else if (item.url || item.previewUrl) {
          finalPhotos.push({ url: item.url || item.previewUrl || '', label: item.label });
        }
      }

      const generatedInclusions = generateInclusionsList();
      const mappedItemsData = equipmentList
        .filter((eq) => selectedItems[eq.model_id]?.checked)
        .map((eq) => ({
          model_id: eq.model_id,
          name: eq.name,
          category: eq.category,
          qty: selectedItems[eq.model_id].qty,
        }));

      const targetPkgId = editingPkg ? editingPkg.id : `pkg-${Date.now()}`;

      const setupTimeText = setupTimeDigits ? `${setupTimeDigits} Hours` : '';
      const crewSizeText = crewSizeDigits ? `${crewSizeDigits} Technicians` : '';

      const dbPayload = {
        package_id: targetPkgId,
        name: pkgName.trim(),
        tag: pkgTag.trim() || 'Standard Setup',
        price: formattedPrice,
        raw_price: numericPrice,
        description: pkgDesc.trim(),
        img: finalCoverUrl || '',
        photos: finalPhotos,
        inclusions: generatedInclusions,
        recommended_for: recommendedList,
        specs: {
          setupTime: setupTimeText,
          crewSize: crewSizeText,
        },
        items: mappedItemsData,
        updated_at: new Date().toISOString(),
      };

      if (editingPkg) {
        // SUPABASE UPDATE
        const { error: updateErr } = await supabase
          .from('packages')
          .update(dbPayload)
          .eq('package_id', targetPkgId);

        if (updateErr) {
          console.warn('Supabase package update warning:', updateErr);
        }

        // Local state update
        setPackages((prev) =>
          prev.map((p) =>
            p.id === editingPkg.id
              ? {
                  ...p,
                  name: dbPayload.name,
                  tag: dbPayload.tag,
                  price: dbPayload.price,
                  rawPrice: dbPayload.raw_price,
                  desc: dbPayload.description,
                  img: dbPayload.img,
                  photos: finalPhotos,
                  inclusions: dbPayload.inclusions,
                  recommendedFor: dbPayload.recommended_for,
                  specs: dbPayload.specs,
                }
              : p
          )
        );

        await logAuditToSupabase(
          'UPDATE_PACKAGE',
          targetPkgId,
          `Updated package pricing and equipment specs for ${dbPayload.name}`
        );
        setEditingPkg(null);
      } else {
        // SUPABASE CREATE
        const { error: insertErr } = await supabase.from('packages').insert([dbPayload]);

        if (insertErr) {
          console.warn('Supabase package insert warning:', insertErr);
        }

        const newPkg: PackageData = {
          id: targetPkgId,
          name: dbPayload.name,
          tag: dbPayload.tag,
          price: dbPayload.price,
          rawPrice: dbPayload.raw_price,
          desc: dbPayload.description,
          img: dbPayload.img,
          photos: finalPhotos,
          inclusions: dbPayload.inclusions,
          recommendedFor: dbPayload.recommended_for,
          specs: dbPayload.specs,
        };

        setPackages([newPkg, ...packages]);
        await logAuditToSupabase(
          'CREATE_PACKAGE',
          targetPkgId,
          `Published new signature package ${dbPayload.name} (${dbPayload.price})`
        );
        setShowCreateModal(false);
      }
    } catch (err: any) {
      console.error('Error saving package:', err);
      setFormError(err.message || 'Failed to save package. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // =========================================================================
  // DELETE PACKAGE (WITH SUPABASE DB & AUDIT LOGS)
  // =========================================================================
  const handleDeletePackageConfirm = async () => {
    if (!deleteConfirmPkg) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('packages')
        .delete()
        .eq('package_id', deleteConfirmPkg.id);

      if (error) {
        console.warn('Supabase package delete note:', error);
      }

      setPackages((prev) => prev.filter((p) => p.id !== deleteConfirmPkg.id));
      await logAuditToSupabase(
        'DELETE_PACKAGE',
        deleteConfirmPkg.id,
        `Deleted package ${deleteConfirmPkg.name}`
      );
      setDeleteConfirmPkg(null);
    } catch (err) {
      console.error('Error deleting package:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredPackages = packages.filter(
    (pkg) =>
      pkg.name.toLowerCase().includes(search.toLowerCase()) ||
      pkg.tag.toLowerCase().includes(search.toLowerCase()) ||
      pkg.desc.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#24252c]/[0.06]">
        <div>
          <MonoBadge icon={IconTicket}>Package Builder & Inventory Mapping</MonoBadge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-1.5">
            Signature Production Packages
          </h1>
          <p className="text-xs text-[#24252c]/60 mt-1">
            Build package tiers, configure public detail page inclusions, upload photo covers, and map physical equipment models.
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="bg-[#1090F8] text-white text-xs font-bold px-5 py-2.5 rounded-full hover:bg-[#1090F8]/90 transition-colors shadow-sm self-start sm:self-auto flex items-center gap-1.5 cursor-pointer"
        >
          <IconPlus className="w-4 h-4" />
          <span>Create New Package</span>
        </button>
      </div>

      {/* Search Filter Bar */}
      <div className="flex items-center justify-between gap-4 bg-white p-3.5 rounded-2xl border border-[#24252c]/[0.08] shadow-sm">
        <div className="relative flex-1 max-w-md">
          <IconSearch className="w-4 h-4 text-[#24252c]/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search packages by name, tag, or description..."
            className="w-full pl-9 pr-4 py-2 rounded-full border border-transparent bg-[#EEEEEE] text-xs focus:outline-none focus:border-[#1090F8]"
          />
        </div>
        <div className="text-xs text-[#24252c]/60 font-semibold">
          Showing <span className="text-[#1090F8] font-bold">{filteredPackages.length}</span> Packages
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading ? (
        <div className="grid md:grid-cols-3 gap-5">
          {[1, 2, 3].map((n) => (
            <div key={n} className="bg-white rounded-2xl border border-[#24252c]/10 p-5 animate-pulse space-y-4">
              <div className="aspect-[16/9] bg-[#EEEEEE] rounded-xl" />
              <div className="h-4 bg-[#EEEEEE] rounded w-1/3" />
              <div className="h-6 bg-[#EEEEEE] rounded w-3/4" />
              <div className="h-10 bg-[#EEEEEE] rounded" />
            </div>
          ))}
        </div>
      ) : filteredPackages.length === 0 ? (
        /* Empty Database State */
        <div className="bg-white rounded-3xl border border-[#24252c]/10 p-12 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-[var(--mist)] flex items-center justify-center mx-auto text-[#24252c]/40">
            <IconBox className="w-6 h-6" />
          </div>
          <h3 className="font-extrabold text-base text-[var(--ink)]">No Packages Found in Database</h3>
          <p className="text-xs text-[#24252c]/60 max-w-md mx-auto">
            {search
              ? `No packages match your search filter "${search}".`
              : 'No event package records exist in the database table. Click below to add your first package.'}
          </p>
          {!search && (
            <button
              onClick={handleOpenCreateModal}
              className="bg-[#1090F8] text-white text-xs font-bold px-5 py-2.5 rounded-full hover:bg-[#1090F8]/90 transition-colors shadow-sm inline-flex items-center gap-1.5 cursor-pointer"
            >
              <IconPlus className="w-4 h-4" />
              <span>Create First Package</span>
            </button>
          )}
        </div>
      ) : (
        /* Package Cards Grid */
        <div className="grid md:grid-cols-3 gap-5">
          {filteredPackages.map((pkg) => (
            <div
              key={pkg.id}
              className="bg-white rounded-2xl border border-[#24252c]/[0.08] p-5 shadow-sm flex flex-col justify-between group hover:shadow-md transition-shadow"
            >
              <div>
                <div className="aspect-[16/9] rounded-xl bg-[var(--mist)] overflow-hidden mb-4 relative flex items-center justify-center">
                  {pkg.img ? (
                    <img src={pkg.img} alt={pkg.name} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300" />
                  ) : (
                    <div className="text-xs text-[#24252c]/40 font-medium">No Image Uploaded</div>
                  )}
                  <span className="absolute top-3 right-3 text-xs font-extrabold bg-white/95 backdrop-blur-md px-3 py-1 rounded-full text-[#1090F8] border border-black/10 shadow-sm">
                    {pkg.price}
                  </span>
                  <span className="absolute top-3 left-3 text-[10px] font-extrabold bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full text-white">
                    {pkg.photos?.length || 0} Photos
                  </span>
                </div>
                {pkg.tag && (
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#24252c]/50">
                    {pkg.tag}
                  </span>
                )}
                <h3 className="font-extrabold text-base text-[var(--ink)] mt-1">{pkg.name}</h3>
                <p className="text-xs text-[#24252c]/60 mt-1 leading-relaxed line-clamp-2">{pkg.desc || 'No description provided.'}</p>

                {/* Recommended For Badges */}
                {pkg.recommendedFor && pkg.recommendedFor.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-[#24252c]/[0.06]">
                    <div className="text-[10px] uppercase font-bold text-[#24252c]/50 mb-1">Recommended For:</div>
                    <div className="flex flex-wrap gap-1">
                      {pkg.recommendedFor.slice(0, 2).map((item, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] font-medium bg-[var(--mist)] px-2 py-0.5 rounded-md border border-[#24252c]/10 text-[var(--ink)] truncate max-w-[140px]"
                        >
                          • {item}
                        </span>
                      ))}
                      {pkg.recommendedFor.length > 2 && (
                        <span className="text-[10px] font-bold text-[#1090F8] self-center">
                          +{pkg.recommendedFor.length - 2} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Card Action Buttons */}
              <div className="mt-4 pt-3 border-t border-[#24252c]/[0.06] flex items-center gap-2">
                <button
                  onClick={() => handleOpenEditModal(pkg)}
                  className="flex-1 bg-[var(--mist)] text-[var(--ink)] text-xs font-bold py-2.5 rounded-full border border-[#24252c]/10 hover:bg-[var(--ink)] hover:text-white transition-colors cursor-pointer text-center"
                >
                  Edit Pricing & Map Gear
                </button>
                <button
                  onClick={() => setDeleteConfirmPkg(pkg)}
                  className="p-2.5 rounded-full border border-red-200 text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                  title="Delete Package"
                >
                  <IconTrash className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Package Builder Modal — Single Uniform Non-Resizing Height Frame */}
      <ModalOverlay
        isOpen={showCreateModal || !!editingPkg}
        onClose={() => {
          if (!isSubmitting) {
            setShowCreateModal(false);
            setEditingPkg(null);
          }
        }}
      >
        <div className="bg-white rounded-[2.5rem] max-w-4xl w-full h-[85vh] shadow-2xl border border-[#24252c]/10 relative p-1.5 sm:p-2.5 overflow-hidden flex flex-col">
          <button
            onClick={() => {
              if (!isSubmitting) {
                setShowCreateModal(false);
                setEditingPkg(null);
              }
            }}
            className="absolute top-6 right-6 z-20 text-[#24252c]/50 hover:text-[var(--ink)] p-1.5 rounded-full hover:bg-[var(--mist)] transition-colors bg-white/90 backdrop-blur-md shadow-sm border border-[#24252c]/10 cursor-pointer"
          >
            <IconX className="w-5 h-5" />
          </button>

          <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6 modal-scroll pr-4 sm:pr-6">
            <div>
              <span className="text-xs font-mono font-bold text-[#1090F8] uppercase tracking-wider">
                {editingPkg ? `Editing ID: ${editingPkg.id}` : 'New Package Setup'}
              </span>
              <h2 className="text-2xl font-extrabold text-[var(--ink)] mt-0.5">
                {editingPkg ? `Edit ${editingPkg.name}` : 'Create New Event Package'}
              </h2>
              <p className="text-xs text-[#24252c]/60 mt-1">
                Define package details, upload cover & gallery photos, set base rate, and map equipment units from inventory database.
              </p>
            </div>

            {/* Validation Error Banner */}
            {formError && (
              <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center justify-between">
                <span>{formError}</span>
                <button type="button" onClick={() => setFormError('')} className="text-red-500 hover:text-red-800">
                  <IconX className="w-4 h-4" />
                </button>
              </div>
            )}

            <form onSubmit={handleSavePackage} className="space-y-6">
              {/* SECTION 1: BASIC INFORMATION & PRICING */}
              <div className="bg-[var(--mist)] p-5 rounded-2xl border border-[#24252c]/[0.08] space-y-4">
                <h3 className="font-extrabold text-sm text-[var(--ink)] flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#1090F8] text-white text-[10px] flex items-center justify-center font-bold">
                    1
                  </span>
                  Basic Information & Pricing
                </h3>

                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="font-semibold uppercase text-[#24252c]/50 block mb-1 text-[10px]">
                      Package Title / Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      value={pkgName}
                      onChange={(e) => setPkgName(e.target.value)}
                      placeholder="e.g. Package B — Celebration Setup"
                      className={inputClass}
                      required
                    />
                  </div>

                  {/* Daily Package Rate (Digits Only with ₱ Badge Outside) */}
                  <div>
                    <label className="font-semibold uppercase text-[#24252c]/50 block mb-1 text-[10px]">
                      Daily Package Rate <span className="text-red-500">*</span> (Digits Only)
                    </label>
                    <div className="relative flex items-center">
                      <span className="absolute left-4 text-xs font-extrabold text-[#1090F8] select-none pointer-events-none">
                        ₱
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={pkgPriceDigits}
                        onChange={(e) => setPkgPriceDigits(e.target.value.replace(/\D/g, ''))}
                        placeholder="28000"
                        className="w-full rounded-full border pl-8 pr-4 py-2.5 text-xs bg-[#EEEEEE] text-[var(--ink)] font-bold text-[#1090F8] focus:outline-none focus:border-[#1090F8] border-transparent transition-colors"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="font-semibold uppercase text-[#24252c]/50 block mb-1 text-[10px]">
                      Setup Subtitle / Tag
                    </label>
                    <input
                      value={pkgTag}
                      onChange={(e) => setPkgTag(e.target.value)}
                      placeholder="e.g. Celebration Setup"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="font-semibold uppercase text-[#24252c]/50 block mb-1 text-[10px]">
                      Overview Description
                    </label>
                    <input
                      value={pkgDesc}
                      onChange={(e) => setPkgDesc(e.target.value)}
                      placeholder="Brief summary of who this package is built for..."
                      className={inputClass}
                    />
                  </div>
                </div>

                {/* Cover Image Upload Component (No External URL Input) */}
                <div className="pt-2">
                  <label className="font-semibold uppercase text-[#24252c]/50 block mb-1.5 text-[10px]">
                    Package Cover Photo (Upload File)
                  </label>
                  <div className="flex flex-col sm:flex-row gap-4 items-center">
                    {/* Cover Preview Box */}
                    <div className="w-full sm:w-44 aspect-[16/10] rounded-2xl bg-white border border-[#24252c]/10 overflow-hidden relative group shrink-0 flex items-center justify-center">
                      {coverPreview ? (
                        <img src={coverPreview} alt="Cover Preview" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-[#24252c]/40 text-xs p-2 text-center">
                          <span>No Image Uploaded</span>
                        </div>
                      )}
                      <span className="absolute bottom-2 left-2 text-[9px] font-bold bg-black/60 text-white px-2 py-0.5 rounded-full backdrop-blur-md">
                        Cover Preview
                      </span>
                    </div>

                    {/* File Upload Controls */}
                    <div className="flex-1 w-full space-y-2">
                      <div className="flex items-center gap-3">
                        <label className="bg-white border border-[#24252c]/20 hover:border-[#1090F8] text-[var(--ink)] text-xs font-bold px-5 py-2.5 rounded-full cursor-pointer transition-colors shadow-sm flex items-center gap-2">
                          <IconBox className="w-4 h-4 text-[#1090F8]" />
                          <span>Upload Cover Image</span>
                          <input type="file" accept="image/*" onChange={handleCoverFileChange} className="hidden" />
                        </label>
                        {coverFile && (
                          <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                            <IconCheck className="w-4 h-4" /> Ready to Upload
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Multiple Gallery Photos Section */}
                <div className="pt-2 border-t border-[#24252c]/[0.08]">
                  <div className="flex items-center justify-between mb-2">
                    <label className="font-semibold uppercase text-[#24252c]/50 block text-[10px]">
                      Secondary Gallery Photos ({galleryPhotos.length} Added)
                    </label>
                    <label className="text-[10px] text-[#1090F8] font-bold hover:underline cursor-pointer flex items-center gap-1">
                      <IconPlus className="w-3 h-3" />
                      <span>+ Add Gallery Images</span>
                      <input type="file" accept="image/*" multiple onChange={handleAddGalleryPhoto} className="hidden" />
                    </label>
                  </div>

                  {galleryPhotos.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {galleryPhotos.map((photo, idx) => (
                        <div key={idx} className="bg-white p-2 rounded-2xl border border-[#24252c]/10 relative space-y-1.5">
                          <div className="aspect-[4/3] rounded-xl overflow-hidden bg-[var(--mist)] relative">
                            <img src={photo.previewUrl || photo.url} alt={photo.label} className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => handleRemoveGalleryPhoto(idx)}
                              className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 hover:bg-red-600 text-white transition-colors cursor-pointer"
                            >
                              <IconX className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <input
                            value={photo.label}
                            onChange={(e) => handleUpdateGalleryLabel(idx, e.target.value)}
                            placeholder="Photo label..."
                            className="w-full text-[10px] px-2 py-1 bg-[#EEEEEE] rounded-lg border border-transparent focus:outline-none focus:border-[#1090F8]"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-[#24252c]/40 italic">No secondary photos added. Click above to upload gallery images.</p>
                  )}
                </div>
              </div>

              {/* SECTION 2: PUBLIC PAGE RECOMMENDATIONS & SPECS */}
              <div className="bg-[var(--mist)] p-5 rounded-2xl border border-[#24252c]/[0.08] space-y-4">
                <h3 className="font-extrabold text-sm text-[var(--ink)] flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#1090F8] text-white text-[10px] flex items-center justify-center font-bold">
                    2
                  </span>
                  Public Page: Recommended For & Tech Specs
                </h3>

                <div>
                  <label className="font-semibold uppercase text-[#24252c]/50 block mb-1 text-[10px]">
                    Recommended For / Ideal Event Types (Comma-Separated)
                  </label>
                  <input
                    value={pkgRecommendedFor}
                    onChange={(e) => setPkgRecommendedFor(e.target.value)}
                    placeholder="e.g. 18th Birthday Debuts, Intimate Weddings up to 120 guests, Corporate Galas"
                    className={inputClass}
                  />
                  <p className="text-[10px] text-[#24252c]/50 mt-1">Separate multiple event types with commas.</p>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  {/* Setup Duration (Digits only, Hours outside) */}
                  <div>
                    <label className="font-semibold uppercase text-[#24252c]/50 block mb-1 text-[10px]">
                      Setup Duration (Digits Only)
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={setupTimeDigits}
                        onChange={(e) => setSetupTimeDigits(e.target.value.replace(/[^0-9.]/g, ''))}
                        placeholder="2.5"
                        className="w-full rounded-full border pl-4 pr-16 py-2.5 text-xs bg-[#EEEEEE] text-[var(--ink)] focus:outline-none focus:border-[#1090F8] border-transparent"
                      />
                      <span className="absolute right-4 text-xs font-bold text-[#24252c]/50 select-none pointer-events-none">
                        Hours
                      </span>
                    </div>
                  </div>

                  {/* Technical Crew Size (Digits only, Technicians outside) */}
                  <div>
                    <label className="font-semibold uppercase text-[#24252c]/50 block mb-1 text-[10px]">
                      Technical Crew Size (Digits Only)
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={crewSizeDigits}
                        onChange={(e) => setCrewSizeDigits(e.target.value.replace(/\D/g, ''))}
                        placeholder="3"
                        className="w-full rounded-full border pl-4 pr-24 py-2.5 text-xs bg-[#EEEEEE] text-[var(--ink)] focus:outline-none focus:border-[#1090F8] border-transparent"
                      />
                      <span className="absolute right-4 text-xs font-bold text-[#24252c]/50 select-none pointer-events-none">
                        Technicians
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 3: INVENTORY EQUIPMENT MAPPING & QUANTITY CHECKER */}
              <div className="bg-[var(--mist)] p-5 rounded-2xl border border-[#24252c]/[0.08] space-y-4 min-h-[300px]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h3 className="font-extrabold text-sm text-[var(--ink)] flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#1090F8] text-white text-[10px] flex items-center justify-center font-bold">
                      3
                    </span>
                    Inventory Equipment Mapping & Quantity Checker
                  </h3>

                  {/* Quantity Counter Badge */}
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className="text-[10px] font-bold bg-[#1090F8]/10 text-[#1090F8] px-3 py-1 rounded-full border border-[#1090F8]/20">
                      {totalSelectedCount} Equipment Models ({totalUnitsMapped} Total Units Mapped)
                    </span>
                  </div>
                </div>

                {/* Category Filter Tabs */}
                {uniqueCategories.length > 1 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 pb-1 border-b border-[#24252c]/[0.06]">
                    {uniqueCategories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategoryTab(cat)}
                        className={`text-[10px] font-bold px-3.5 py-1.5 rounded-full border transition-all duration-200 cursor-pointer ${
                          selectedCategoryTab === cat
                            ? 'bg-[#1090F8] text-white border-[#1090F8] shadow-sm scale-105'
                            : 'bg-white text-[var(--ink)] border-[#24252c]/10 hover:border-[#1090F8]'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}

                {/* Database Equipment Items Grouped by Category */}
                {equipmentList.length === 0 ? (
                  <div className="p-6 bg-white rounded-2xl text-center border border-[#24252c]/10 space-y-2">
                    <p className="text-xs text-[#24252c]/60 italic font-medium">
                      No equipment models found in the database.
                    </p>
                    <p className="text-[10px] text-[#24252c]/40">
                      Please add equipment models and physical units in the Inventory Manager to map gear to packages.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Object.keys(groupedEquipment).map((catName) => (
                      <div key={catName} className="space-y-2.5">
                        {/* Category Separator Header */}
                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#1090F8] bg-[#1090F8]/10 px-2.5 py-0.5 rounded-md">
                            {catName} Category
                          </span>
                          <div className="h-[1px] bg-[#24252c]/10 flex-1" />
                        </div>

                        {/* Grid of Equipment Models (Capped by DB Stock Limits) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {groupedEquipment[catName].map((item) => {
                            const itemState = selectedItems[item.model_id] || { checked: false, qty: 1 };
                            const maxStock = item.availableUnits > 0 ? item.availableUnits : 1;
                            const isMaxReached = itemState.qty >= maxStock;
                            const isMinReached = itemState.qty <= 1;

                            return (
                              <div
                                key={item.model_id}
                                className={`p-3 sm:px-4 sm:py-2.5 rounded-2xl border flex items-center justify-between gap-3 min-h-[56px] transition-all duration-200 ${
                                  itemState.checked
                                    ? 'bg-white border-[#1090F8]/40 shadow-sm'
                                    : 'bg-white/60 border-[#24252c]/10 opacity-70 hover:opacity-100'
                                }`}
                              >
                                <label className="flex items-center gap-3 cursor-pointer select-none min-w-0 flex-1">
                                  <input
                                    type="checkbox"
                                    checked={itemState.checked}
                                    onChange={() => toggleItemCheck(item.model_id)}
                                    className="w-4.5 h-4.5 accent-[#1090F8] rounded cursor-pointer shrink-0"
                                  />
                                  <div className="min-w-0">
                                    <div className="font-bold text-xs text-[var(--ink)] break-words leading-tight">
                                      {item.name}
                                    </div>
                                    <div className="text-[10px] text-[#24252c]/50 mt-0.5">
                                      {item.availableUnits > 0
                                        ? `${item.availableUnits} Unit${item.availableUnits > 1 ? 's' : ''} Stock in Database`
                                        : 'Stock Unspecified'}
                                    </div>
                                  </div>
                                </label>

                                {/* Stepper Container — Smooth Fade & Capped by Database Stock */}
                                <div
                                  className={`flex items-center gap-1.5 shrink-0 bg-[var(--mist)] px-3 py-1 rounded-full border border-[#24252c]/10 transition-all duration-200 ${
                                    itemState.checked
                                      ? 'opacity-100 scale-100 pointer-events-auto'
                                      : 'opacity-0 scale-95 pointer-events-none'
                                  }`}
                                >
                                  <button
                                    type="button"
                                    tabIndex={itemState.checked ? 0 : -1}
                                    disabled={isMinReached}
                                    onClick={() => updateItemQty(item.model_id, -1, maxStock)}
                                    className="w-5 h-5 rounded-full bg-white text-[var(--ink)] font-bold text-xs flex items-center justify-center hover:bg-[#1090F8] hover:text-white transition-colors shadow-sm cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                  >
                                    -
                                  </button>
                                  <span className="font-extrabold text-xs text-[#1090F8] min-w-[22px] text-center">
                                    {itemState.qty}
                                    <span className="text-[9px] font-normal text-[#24252c]/40 font-mono">
                                      /{maxStock}
                                    </span>
                                  </span>
                                  <button
                                    type="button"
                                    tabIndex={itemState.checked ? 0 : -1}
                                    disabled={isMaxReached}
                                    onClick={() => updateItemQty(item.model_id, 1, maxStock)}
                                    className="w-5 h-5 rounded-full bg-white text-[var(--ink)] font-bold text-xs flex items-center justify-center hover:bg-[#1090F8] hover:text-white transition-colors shadow-sm cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                    title={
                                      isMaxReached
                                        ? `Maximum available stock reached (${maxStock} Units in DB)`
                                        : 'Increase Quantity'
                                    }
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SECTION 4: LIVE PUBLIC INCLUSIONS PREVIEW */}
              {generateInclusionsList().length > 0 && (
                <div className="bg-white p-5 rounded-2xl border border-[#24252c]/10 space-y-3">
                  <h4 className="font-extrabold text-xs text-[var(--ink)] uppercase tracking-wider">
                    Live Public Detail Page Inclusions Preview
                  </h4>
                  <div className="space-y-1.5 pl-2">
                    {generateInclusionsList().map((inc, i) => (
                      <div key={i} className="text-xs text-[#24252c]/70 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#1090F8]" />
                        <span>{inc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-[var(--ink)] text-white text-sm font-extrabold py-4 rounded-full hover:bg-[var(--ink-soft)] transition-colors shadow-lg disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <span>Processing & Uploading to Supabase...</span>
                  ) : editingPkg ? (
                    'Save Package Details & Mapped Gear'
                  ) : (
                    'Publish New Signature Package'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </ModalOverlay>

      {/* Delete Confirmation Modal */}
      <ModalOverlay isOpen={!!deleteConfirmPkg} onClose={() => setDeleteConfirmPkg(null)}>
        <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-[#24252c]/10">
          <div className="flex items-center gap-3 text-red-600">
            <div className="p-3 bg-red-50 rounded-full">
              <IconTrash className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-[var(--ink)]">Delete Package?</h3>
              <p className="text-xs text-[#24252c]/60 mt-0.5">
                Are you sure you want to remove <span className="font-bold">{deleteConfirmPkg?.name}</span>? This action will update Supabase database records and audit logs.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => setDeleteConfirmPkg(null)}
              className="flex-1 py-3 rounded-full border border-[#24252c]/20 text-xs font-bold text-[var(--ink)] hover:bg-[#EEEEEE] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleDeletePackageConfirm}
              disabled={isSubmitting}
              className="flex-1 py-3 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'Deleting...' : 'Delete Package'}
            </button>
          </div>
        </div>
      </ModalOverlay>
    </div>
  );
}
