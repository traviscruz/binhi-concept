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
import { type PackageData, FEATURED_PACKAGES } from '../../data/packages';
import { supabase } from '../../lib/supabase';
import { logAuditEvent } from '../../utils/auditLogger';

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

export interface MediaLibraryItem {
  id: string;
  url: string;
  label: string;
  source: string;
  category: 'package' | 'gallery' | 'storage';
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

  // Media Library Picker Modal State
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [mediaPickerTarget, setMediaPickerTarget] = useState<'gallery' | 'cover'>('gallery');
  const [availableMedia, setAvailableMedia] = useState<MediaLibraryItem[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [mediaSearchQuery, setMediaSearchQuery] = useState('');
  const [mediaCategoryFilter, setMediaCategoryFilter] = useState<'all' | 'package' | 'gallery' | 'storage'>('all');
  const [selectedMediaForGallery, setSelectedMediaForGallery] = useState<MediaLibraryItem[]>([]);

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
  const [pkgVenueSize, setPkgVenueSize] = useState('');
  const [pkgGuestCapacity, setPkgGuestCapacity] = useState('');
  const [pkgGuestMin, setPkgGuestMin] = useState('');
  const [pkgGuestMax, setPkgGuestMax] = useState('');
  const [pkgAcousticCoverage, setPkgAcousticCoverage] = useState('');
  const [pkgPowerReq, setPkgPowerReq] = useState('');

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
          specs: {
            powerReq: item.specs?.powerReq || '',
            setupTime: item.specs?.setupTime || '',
            crewSize: item.specs?.crewSize || '',
            venueSize: item.specs?.venueSize || '',
            guestCapacity: item.specs?.guestCapacity || '',
            guestMin: item.specs?.guestMin !== undefined ? Number(item.specs.guestMin) : 20,
            guestMax: item.specs?.guestMax !== undefined ? Number(item.specs.guestMax) : 500,
            acousticCoverage: item.specs?.acousticCoverage || '',
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
  // MEDIA LIBRARY & PRE-UPLOADED PHOTO PICKER HELPERS
  // =========================================================================
  const loadAvailableMedia = async () => {
    setLoadingMedia(true);
    const mediaMap = new Map<string, MediaLibraryItem>();

    // 1. Gather all photos from current packages in database
    packages.forEach((pkg) => {
      if (pkg.img && typeof pkg.img === 'string' && pkg.img.trim()) {
        const clean = pkg.img.trim();
        if (!clean.includes('picsum.photos') && !mediaMap.has(clean)) {
          mediaMap.set(clean, {
            id: `db-pkg-cover-${pkg.id}`,
            url: clean,
            label: `${pkg.name} Cover`,
            source: pkg.name,
            category: 'package',
          });
        }
      }

      if (Array.isArray(pkg.photos)) {
        pkg.photos.forEach((ph, i) => {
          const phUrl = typeof ph === 'string' ? ph : ph?.url;
          const phLabel = typeof ph === 'string' ? `${pkg.name} Gallery ${i + 1}` : (ph?.label || `${pkg.name} Photo ${i + 1}`);
          if (phUrl && typeof phUrl === 'string' && phUrl.trim() && !phUrl.includes('picsum.photos')) {
            const clean = phUrl.trim();
            if (!mediaMap.has(clean)) {
              mediaMap.set(clean, {
                id: `db-pkg-gal-${pkg.id}-${i}`,
                url: clean,
                label: phLabel,
                source: pkg.name,
                category: 'gallery',
              });
            }
          }
        });
      }
    });

    // 2. Gather from FEATURED_PACKAGES preset list
    FEATURED_PACKAGES.forEach((pkg) => {
      if (pkg.img && typeof pkg.img === 'string' && pkg.img.trim() && !pkg.img.includes('picsum.photos')) {
        const clean = pkg.img.trim();
        if (!mediaMap.has(clean)) {
          mediaMap.set(clean, {
            id: `preset-cover-${pkg.id}`,
            url: clean,
            label: `${pkg.name} Preset Cover`,
            source: `${pkg.name} (Preset)`,
            category: 'package',
          });
        }
      }

      if (Array.isArray(pkg.photos)) {
        pkg.photos.forEach((ph, i) => {
          const phUrl = typeof ph === 'string' ? ph : ph?.url;
          const phLabel = typeof ph === 'string' ? `${pkg.name} Preset ${i + 1}` : (ph?.label || `${pkg.name} Gallery ${i + 1}`);
          if (phUrl && typeof phUrl === 'string' && phUrl.trim() && !phUrl.includes('picsum.photos')) {
            const clean = phUrl.trim();
            if (!mediaMap.has(clean)) {
              mediaMap.set(clean, {
                id: `preset-gal-${pkg.id}-${i}`,
                url: clean,
                label: phLabel,
                source: `${pkg.name} (Preset)`,
                category: 'gallery',
              });
            }
          }
        });
      }
    });

    // 3. Gather directly from Supabase Storage buckets ('package-images' and 'equipment-images')
    try {
      const buckets = ['package-images', 'equipment-images'];
      for (const bucketName of buckets) {
        try {
          // List root files
          const { data: rootItems } = await supabase.storage.from(bucketName).list('', { limit: 100 });
          if (rootItems) {
            for (const item of rootItems) {
              if (item.name && !item.name.startsWith('.')) {
                // If it might be a folder (e.g., 'packages' or 'equipment')
                if (!item.id || item.metadata === null) {
                  const { data: subItems } = await supabase.storage.from(bucketName).list(item.name, { limit: 100 });
                  if (subItems) {
                    for (const sub of subItems) {
                      if (sub.name && !sub.name.startsWith('.')) {
                        const fullPath = `${item.name}/${sub.name}`;
                        const { data: pUrl } = supabase.storage.from(bucketName).getPublicUrl(fullPath);
                        if (pUrl?.publicUrl && !mediaMap.has(pUrl.publicUrl)) {
                          mediaMap.set(pUrl.publicUrl, {
                            id: `storage-${bucketName}-${sub.name}`,
                            url: pUrl.publicUrl,
                            label: sub.name.replace(/\.[^/.]+$/, '').replace(/pkg_\d+_/, '').replace(/\d+-/, ''),
                            source: `${bucketName}/${item.name}`,
                            category: 'storage',
                          });
                        }
                      }
                    }
                  }
                } else {
                  const { data: pUrl } = supabase.storage.from(bucketName).getPublicUrl(item.name);
                  if (pUrl?.publicUrl && !mediaMap.has(pUrl.publicUrl)) {
                    mediaMap.set(pUrl.publicUrl, {
                      id: `storage-${bucketName}-${item.name}`,
                      url: pUrl.publicUrl,
                      label: item.name.replace(/\.[^/.]+$/, '').replace(/pkg_\d+_/, ''),
                      source: bucketName,
                      category: 'storage',
                    });
                  }
                }
              }
            }
          }
        } catch (bucketErr) {
          console.warn(`Storage query warning for bucket ${bucketName}:`, bucketErr);
        }
      }
    } catch (storageErr) {
      console.warn('Storage media scanner error:', storageErr);
    }

    setAvailableMedia(Array.from(mediaMap.values()));
    setLoadingMedia(false);
  };

  const handleOpenMediaPicker = (target: 'gallery' | 'cover') => {
    setMediaPickerTarget(target);
    setSelectedMediaForGallery([]);
    setMediaSearchQuery('');
    setMediaCategoryFilter('all');
    setShowMediaPicker(true);
    loadAvailableMedia();
  };

  const toggleSelectMediaForGallery = (item: MediaLibraryItem) => {
    setSelectedMediaForGallery((prev) => {
      const exists = prev.some((p) => p.url === item.url);
      if (exists) {
        return prev.filter((p) => p.url !== item.url);
      }
      return [...prev, item];
    });
  };

  const handleQuickAddSinglePhotoToGallery = (item: MediaLibraryItem) => {
    const isAlreadyInGallery = galleryPhotos.some((p) => p.url === item.url || p.previewUrl === item.url);
    if (!isAlreadyInGallery) {
      setGalleryPhotos((prev) => [
        ...prev,
        {
          url: item.url,
          label: item.label || 'Gallery Photo',
          previewUrl: item.url,
        },
      ]);
    }
  };

  const handleAddSelectedMediaToGallery = () => {
    if (selectedMediaForGallery.length === 0) return;

    const newToAdd: GalleryPhoto[] = [];
    selectedMediaForGallery.forEach((item) => {
      const isAlreadyInGallery = galleryPhotos.some((p) => p.url === item.url || p.previewUrl === item.url);
      if (!isAlreadyInGallery) {
        newToAdd.push({
          url: item.url,
          label: item.label || 'Gallery Photo',
          previewUrl: item.url,
        });
      }
    });

    if (newToAdd.length > 0) {
      setGalleryPhotos((prev) => [...prev, ...newToAdd]);
    }
    setShowMediaPicker(false);
    setSelectedMediaForGallery([]);
  };

  const handleSelectCoverFromMedia = (item: MediaLibraryItem) => {
    setCoverFile(null);
    setCoverPreview(item.url);
    setShowMediaPicker(false);
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

    setPkgVenueSize(pkg.specs?.venueSize || '');
    setPkgGuestCapacity(pkg.specs?.guestCapacity || '');
    setPkgGuestMin(pkg.specs?.guestMin !== undefined ? String(pkg.specs.guestMin) : '');
    setPkgGuestMax(pkg.specs?.guestMax !== undefined ? String(pkg.specs.guestMax) : '');
    setPkgAcousticCoverage(pkg.specs?.acousticCoverage || '');
    setPkgPowerReq(pkg.specs?.powerReq || '');

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
    setPkgVenueSize('');
    setPkgGuestCapacity('');
    setPkgGuestMin('');
    setPkgGuestMax('');
    setPkgAcousticCoverage('');
    setPkgPowerReq('');
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

      const parsedGuestMin = pkgGuestMin ? parseInt(pkgGuestMin) : 20;
      const parsedGuestMax = pkgGuestMax ? parseInt(pkgGuestMax) : 500;

      const specsPayload: any = {
        setupTime: setupTimeText,
        crewSize: crewSizeText,
        powerReq: pkgPowerReq.trim(),
        venueSize: pkgVenueSize.trim(),
        guestCapacity: pkgGuestCapacity.trim(),
        acousticCoverage: pkgAcousticCoverage.trim(),
        guestMin: parsedGuestMin,
        guestMax: parsedGuestMax,
      };

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
        specs: specsPayload,
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

        const priceChanged = editingPkg.rawPrice !== dbPayload.raw_price;
        await logAuditEvent({
          action: priceChanged ? 'UPDATE_PACKAGE_PRICE' : 'UPDATE_PACKAGE',
          module: 'packages',
          targetId: targetPkgId,
          targetName: dbPayload.name,
          details: priceChanged
            ? `Updated rate for package "${dbPayload.name}" from ${editingPkg.price} to ${dbPayload.price}`
            : `Updated equipment specifications and inclusions for "${dbPayload.name}"`,
          previousData: {
            name: editingPkg.name,
            price: editingPkg.price,
            rawPrice: editingPkg.rawPrice,
            specs: editingPkg.specs,
            inclusions: editingPkg.inclusions,
          },
          currentData: {
            name: dbPayload.name,
            price: dbPayload.price,
            rawPrice: dbPayload.raw_price,
            specs: dbPayload.specs,
            inclusions: dbPayload.inclusions,
          },
        });
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
        await logAuditEvent({
          action: 'CREATE_PACKAGE',
          module: 'packages',
          targetId: targetPkgId,
          targetName: dbPayload.name,
          details: `Created new package "${dbPayload.name}" (${dbPayload.price}/day) with ${dbPayload.inclusions.length} mapped items`,
          currentData: {
            name: dbPayload.name,
            price: dbPayload.price,
            rawPrice: dbPayload.raw_price,
            inclusions: dbPayload.inclusions,
            specs: dbPayload.specs,
          },
        });
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
      await logAuditEvent({
        action: 'DELETE_PACKAGE',
        module: 'packages',
        targetId: deleteConfirmPkg.id,
        targetName: deleteConfirmPkg.name,
        details: `Deleted package "${deleteConfirmPkg.name}" (${deleteConfirmPkg.price})`,
        previousData: {
          id: deleteConfirmPkg.id,
          name: deleteConfirmPkg.name,
          price: deleteConfirmPkg.price,
          rawPrice: deleteConfirmPkg.rawPrice,
        },
      });
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

                {/* Cover Image Upload Component (With Media Library Option) */}
                <div className="pt-2">
                  <label className="font-semibold uppercase text-[#24252c]/50 block mb-1.5 text-[10px]">
                    Package Cover Photo (Upload File or Select Existing)
                  </label>
                  <div className="flex flex-col sm:flex-row gap-4 items-center">
                    {/* Cover Preview Box */}
                    <div className="w-full sm:w-44 aspect-[16/10] rounded-2xl bg-white border border-[#24252c]/10 overflow-hidden relative group shrink-0 flex items-center justify-center">
                      {coverPreview ? (
                        <img src={coverPreview} alt="Cover Preview" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-[#24252c]/40 text-xs p-2 text-center">
                          <span>No Image Selected</span>
                        </div>
                      )}
                      <span className="absolute bottom-2 left-2 text-[9px] font-bold bg-black/60 text-white px-2 py-0.5 rounded-full backdrop-blur-md">
                        Cover Preview
                      </span>
                    </div>

                    {/* File Upload & Media Library Controls */}
                    <div className="flex-1 w-full space-y-2">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <label className="bg-white border border-[#24252c]/20 hover:border-[#1090F8] text-[var(--ink)] text-xs font-bold px-4 py-2.5 rounded-full cursor-pointer transition-colors shadow-sm flex items-center gap-2">
                          <IconBox className="w-4 h-4 text-[#1090F8]" />
                          <span>Upload New File</span>
                          <input type="file" accept="image/*" onChange={handleCoverFileChange} className="hidden" />
                        </label>
                        <button
                          type="button"
                          onClick={() => handleOpenMediaPicker('cover')}
                          className="bg-white border border-[#1090F8]/30 hover:bg-[#1090F8]/10 text-[#1090F8] text-xs font-bold px-4 py-2.5 rounded-full transition-all shadow-sm flex items-center gap-2 cursor-pointer"
                        >
                          <IconSearch className="w-3.5 h-3.5" />
                          <span>Select from Uploaded Photos</span>
                        </button>
                        {coverFile && (
                          <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                            <IconCheck className="w-4 h-4" /> Ready to Upload
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[#24252c]/45">
                        Upload a fresh banner or reuse an existing production image already in the system.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Multiple Gallery Photos Section */}
                <div className="pt-2 border-t border-[#24252c]/[0.08]">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                    <div>
                      <label className="font-semibold uppercase text-[#24252c]/50 block text-[10px]">
                        Secondary Gallery Photos ({galleryPhotos.length} Added)
                      </label>
                      <p className="text-[10px] text-[#24252c]/45">
                        Include multi-angle event photos or gear closeups. Choose from already uploaded photos or add new ones.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenMediaPicker('gallery')}
                        className="text-xs font-bold bg-white border border-[#1090F8]/30 hover:bg-[#1090F8]/10 text-[#1090F8] px-3.5 py-1.5 rounded-full transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                      >
                        <IconSearch className="w-3.5 h-3.5" />
                        <span>Select from Uploaded Photos</span>
                      </button>
                      <label className="text-xs font-bold bg-[#1090F8] hover:bg-[#0b7cd0] text-white px-3.5 py-1.5 rounded-full transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer">
                        <IconPlus className="w-3.5 h-3.5" />
                        <span>+ Upload Files</span>
                        <input type="file" accept="image/*" multiple onChange={handleAddGalleryPhoto} className="hidden" />
                      </label>
                    </div>
                  </div>

                  {galleryPhotos.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {galleryPhotos.map((photo, idx) => (
                        <div key={idx} className="bg-white p-2 rounded-2xl border border-[#24252c]/10 relative space-y-1.5 shadow-sm group">
                          <div className="aspect-[4/3] rounded-xl overflow-hidden bg-[var(--mist)] relative">
                            <img src={photo.previewUrl || photo.url} alt={photo.label} className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => handleRemoveGalleryPhoto(idx)}
                              className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 hover:bg-red-600 text-white transition-colors cursor-pointer shadow-sm"
                              title="Remove Photo"
                            >
                              <IconX className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <input
                            value={photo.label}
                            onChange={(e) => handleUpdateGalleryLabel(idx, e.target.value)}
                            placeholder="Photo label..."
                            className="w-full text-[10px] px-2 py-1 bg-[#EEEEEE] rounded-lg border border-transparent focus:outline-none focus:border-[#1090F8] text-[var(--ink)]"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 rounded-2xl border-2 border-dashed border-[#24252c]/15 bg-white/50 text-center space-y-3">
                      <div className="text-xs text-[#24252c]/60 font-medium">
                        No secondary gallery photos added yet.
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => handleOpenMediaPicker('gallery')}
                          className="text-xs font-bold bg-[#1090F8]/10 hover:bg-[#1090F8]/20 text-[#1090F8] border border-[#1090F8]/30 px-4 py-2 rounded-full transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <IconSearch className="w-3.5 h-3.5" />
                          <span>Choose from Uploaded Photos</span>
                        </button>
                        <label className="text-xs font-bold bg-white border border-[#24252c]/20 hover:border-[#1090F8] text-[var(--ink)] px-4 py-2 rounded-full transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm">
                          <IconPlus className="w-3.5 h-3.5 text-[#1090F8]" />
                          <span>Upload Files from Computer</span>
                          <input type="file" accept="image/*" multiple onChange={handleAddGalleryPhoto} className="hidden" />
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION 2: PUBLIC PAGE RECOMMENDATIONS & SPECS */}
              <div className="bg-[var(--mist)] p-5 rounded-2xl border border-[#24252c]/[0.08] space-y-4">
                <h3 className="font-extrabold text-sm text-[var(--ink)] flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#1090F8] text-white text-[10px] flex items-center justify-center font-bold">
                    2
                  </span>
                  Public Page: Venue Sizing, Guest Calibration & Tech Specs
                </h3>

                {/* Recommended Event Types */}
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

                {/* Venue Size & Target Crowd Capacity */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="font-semibold uppercase text-[#24252c]/50 block mb-1 text-[10px]">
                      Recommended Venue Size
                    </label>
                    <input
                      value={pkgVenueSize}
                      onChange={(e) => setPkgVenueSize(e.target.value)}
                      placeholder="e.g. 30 – 100 sq.m or 100 – 250 sq.m"
                      className={inputClass}
                    />
                    <p className="text-[10px] text-[#24252c]/50 mt-1">Displayed in the public Recommended For footprint card.</p>
                  </div>

                  <div>
                    <label className="font-semibold uppercase text-[#24252c]/50 block mb-1 text-[10px]">
                      Target Crowd Capacity
                    </label>
                    <input
                      value={pkgGuestCapacity}
                      onChange={(e) => setPkgGuestCapacity(e.target.value)}
                      placeholder="e.g. 20 – 80 Guests or 80 – 200 Guests"
                      className={inputClass}
                    />
                    <p className="text-[10px] text-[#24252c]/50 mt-1">Recommended crowd scale for optimum sound SPL.</p>
                  </div>
                </div>

                {/* Booking Slider Dynamic Bounds (Min & Max) */}
                <div className="bg-white/80 p-4 rounded-xl border border-[#24252c]/[0.06] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#1090F8]">
                      Dynamic Booking Guest Slider Limits (Min & Max)
                    </span>
                    <span className="text-[10px] text-[#24252c]/50">
                      Engineering Reference Calibration
                    </span>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="font-semibold uppercase text-[#24252c]/50 block mb-1 text-[10px]">
                        Slider Min Guests (Starting / Minimum)
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={pkgGuestMin}
                        onChange={(e) => setPkgGuestMin(e.target.value.replace(/\D/g, ''))}
                        placeholder="e.g. 20, 50, 100"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="font-semibold uppercase text-[#24252c]/50 block mb-1 text-[10px]">
                        Slider Max Guests (Upper Limit)
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={pkgGuestMax}
                        onChange={(e) => setPkgGuestMax(e.target.value.replace(/\D/g, ''))}
                        placeholder="e.g. 100, 250, 500"
                        className={inputClass}
                      />
                    </div>
                  </div>
                </div>

                {/* Acoustic Coverage & Power Requirements */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="font-semibold uppercase text-[#24252c]/50 block mb-1 text-[10px]">
                      Acoustic Sound Field Coverage
                    </label>
                    <input
                      value={pkgAcousticCoverage}
                      onChange={(e) => setPkgAcousticCoverage(e.target.value)}
                      placeholder="e.g. Intimate Indoor & Patio Acoustic Coverage"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="font-semibold uppercase text-[#24252c]/50 block mb-1 text-[10px]">
                      Power Requirement Demand
                    </label>
                    <input
                      value={pkgPowerReq}
                      onChange={(e) => setPkgPowerReq(e.target.value)}
                      placeholder="e.g. 220V 15A Single Phase"
                      className={inputClass}
                    />
                  </div>
                </div>

                {/* Operational Duration & Crew Size */}
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
                    <span>Processing & Saving...</span>
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
                Are you sure you want to remove <span className="font-bold">{deleteConfirmPkg?.name}</span>? This action will remove the package and update audit logs.
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

      {/* Media Library / Uploaded Photos Picker Modal */}
      <ModalOverlay isOpen={showMediaPicker} onClose={() => setShowMediaPicker(false)}>
        <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[88vh] flex flex-col shadow-2xl border border-[#24252c]/10 overflow-hidden relative">
          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-[#24252c]/10 flex items-center justify-between shrink-0 bg-white">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#1090F8] bg-[#1090F8]/10 px-2.5 py-0.5 rounded-md">
                  Media Library
                </span>
                <span className="text-xs text-[#24252c]/50 font-mono font-medium">
                  {availableMedia.length} Photos in Database & Storage
                </span>
              </div>
              <h2 className="text-xl font-extrabold text-[var(--ink)] mt-1">
                {mediaPickerTarget === 'cover' ? 'Select Package Cover Photo' : 'Select Secondary Gallery Photos'}
              </h2>
              <p className="text-xs text-[#24252c]/60 mt-0.5">
                {mediaPickerTarget === 'cover'
                  ? 'Click any previously uploaded photo to set as the main cover photo without duplicate upload.'
                  : 'Select one or more previously uploaded photos across packages and storage without duplicate re-uploading.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowMediaPicker(false)}
              className="text-[#24252c]/50 hover:text-[var(--ink)] p-2 rounded-full hover:bg-[var(--mist)] transition-colors cursor-pointer"
              title="Close Media Library"
            >
              <IconX className="w-5 h-5" />
            </button>
          </div>

          {/* Search & Category Filter Bar */}
          <div className="px-5 sm:px-6 py-3 bg-[var(--mist)] border-b border-[#24252c]/[0.08] flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <div className="relative w-full sm:w-80">
              <IconSearch className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#24252c]/40" />
              <input
                type="text"
                value={mediaSearchQuery}
                onChange={(e) => setMediaSearchQuery(e.target.value)}
                placeholder="Filter by title, package name, or label..."
                className="w-full pl-9 pr-8 py-2 text-xs rounded-full bg-white border border-[#24252c]/15 text-[var(--ink)] placeholder:text-[#24252c]/40 focus:outline-none focus:border-[#1090F8]"
              />
              {mediaSearchQuery && (
                <button
                  type="button"
                  onClick={() => setMediaSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#24252c]/40 hover:text-[var(--ink)]"
                >
                  <IconX className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
              {[
                { id: 'all', label: 'All Photos', count: availableMedia.length },
                { id: 'package', label: 'Package Covers', count: availableMedia.filter((m) => m.category === 'package').length },
                { id: 'gallery', label: 'Gallery Shots', count: availableMedia.filter((m) => m.category === 'gallery').length },
                { id: 'storage', label: 'Storage Buckets', count: availableMedia.filter((m) => m.category === 'storage').length },
              ].map((tab) => {
                const isActive = mediaCategoryFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setMediaCategoryFilter(tab.id as any)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-[var(--ink)] text-white shadow-sm'
                        : 'bg-white text-[#24252c]/60 hover:text-[var(--ink)] border border-[#24252c]/10'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-[#EEEEEE] text-[#24252c]/50'}`}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Photo Grid Content */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 modal-scroll">
            {loadingMedia ? (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
                <div className="w-8 h-8 border-3 border-[#1090F8] border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-[#24252c]/60 font-semibold">Scanning media library and Supabase storage...</p>
              </div>
            ) : availableMedia.filter((item) => {
                const matchesCat = mediaCategoryFilter === 'all' || item.category === mediaCategoryFilter;
                const q = mediaSearchQuery.toLowerCase().trim();
                const matchesSearch = !q || item.label.toLowerCase().includes(q) || item.source.toLowerCase().includes(q) || item.url.toLowerCase().includes(q);
                return matchesCat && matchesSearch;
              }).length === 0 ? (
              <div className="py-16 text-center space-y-2 bg-[var(--mist)] rounded-2xl border border-[#24252c]/10">
                <p className="text-xs text-[#24252c]/60 font-semibold">No photos match your filter criteria.</p>
                <button
                  type="button"
                  onClick={() => {
                    setMediaSearchQuery('');
                    setMediaCategoryFilter('all');
                  }}
                  className="text-xs text-[#1090F8] font-bold hover:underline cursor-pointer"
                >
                  Reset filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
                {availableMedia
                  .filter((item) => {
                    const matchesCat = mediaCategoryFilter === 'all' || item.category === mediaCategoryFilter;
                    const q = mediaSearchQuery.toLowerCase().trim();
                    const matchesSearch = !q || item.label.toLowerCase().includes(q) || item.source.toLowerCase().includes(q) || item.url.toLowerCase().includes(q);
                    return matchesCat && matchesSearch;
                  })
                  .map((item) => {
                    const isSelected = selectedMediaForGallery.some((s) => s.url === item.url);
                    const isAlreadyInGallery = galleryPhotos.some((g) => g.url === item.url || g.previewUrl === item.url);
                    const isCurrentCover = coverPreview === item.url;

                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          if (mediaPickerTarget === 'cover') {
                            handleSelectCoverFromMedia(item);
                          } else {
                            toggleSelectMediaForGallery(item);
                          }
                        }}
                        className={`group relative rounded-2xl overflow-hidden border transition-all cursor-pointer bg-white flex flex-col ${
                          isSelected || (mediaPickerTarget === 'cover' && isCurrentCover)
                            ? 'border-[#1090F8] ring-2 ring-[#1090F8]/30 shadow-md scale-[1.01]'
                            : isAlreadyInGallery
                            ? 'border-emerald-500/40 bg-emerald-50/20'
                            : 'border-[#24252c]/10 hover:border-[#1090F8]/50 hover:shadow-md'
                        }`}
                      >
                        {/* Image Frame */}
                        <div className="aspect-[4/3] bg-[var(--mist)] relative overflow-hidden">
                          <img
                            src={item.url}
                            alt={item.label}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            loading="lazy"
                          />

                          {/* Top Badges */}
                          <div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-1 pointer-events-none">
                            <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-black/60 text-white backdrop-blur-md truncate max-w-[120px]">
                              {item.source}
                            </span>

                            {mediaPickerTarget === 'gallery' && (
                              <>
                                {isSelected ? (
                                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#1090F8] text-white flex items-center gap-1 shadow-sm">
                                    <IconCheck className="w-3 h-3" /> Selected
                                  </span>
                                ) : isAlreadyInGallery ? (
                                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white flex items-center gap-1 shadow-sm">
                                    <IconCheck className="w-3 h-3" /> Added
                                  </span>
                                ) : null}
                              </>
                            )}

                            {mediaPickerTarget === 'cover' && isCurrentCover && (
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#1090F8] text-white flex items-center gap-1 shadow-sm">
                                <IconCheck className="w-3 h-3" /> Current Cover
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Card Info & Action Footer */}
                        <div className="p-2.5 space-y-1.5 flex-1 flex flex-col justify-between">
                          <div className="text-[11px] font-bold text-[var(--ink)] truncate" title={item.label}>
                            {item.label}
                          </div>

                          <div className="pt-1 flex items-center justify-between gap-1">
                            {mediaPickerTarget === 'gallery' ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleQuickAddSinglePhotoToGallery(item);
                                }}
                                disabled={isAlreadyInGallery}
                                className={`text-[10px] font-bold px-2.5 py-1 rounded-full transition-colors w-full flex items-center justify-center gap-1 cursor-pointer ${
                                  isAlreadyInGallery
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-[#EEEEEE] hover:bg-[#1090F8] hover:text-white text-[var(--ink)]'
                                }`}
                              >
                                {isAlreadyInGallery ? (
                                  <>
                                    <IconCheck className="w-3 h-3" /> In Gallery
                                  </>
                                ) : (
                                  <>
                                    <IconPlus className="w-3 h-3" /> Add to Gallery
                                  </>
                                )}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectCoverFromMedia(item);
                                }}
                                className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#1090F8] text-white hover:bg-[#0b7cd0] transition-colors w-full flex items-center justify-center gap-1 cursor-pointer"
                              >
                                <IconCheck className="w-3 h-3" /> Set as Cover
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Footer with Batch Actions */}
          <div className="p-4 sm:p-5 border-t border-[#24252c]/10 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 text-xs text-[#24252c]/60">
              {mediaPickerTarget === 'gallery' ? (
                <div className="flex items-center gap-3">
                  <span>
                    <strong className="text-[var(--ink)]">{selectedMediaForGallery.length}</strong> photo(s) selected
                  </span>
                  {selectedMediaForGallery.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedMediaForGallery([])}
                      className="text-xs text-red-600 hover:underline font-bold cursor-pointer"
                    >
                      Clear Selection
                    </button>
                  )}
                </div>
              ) : (
                <span>Click any image above to immediately select as the cover photo</span>
              )}
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setShowMediaPicker(false)}
                className="flex-1 sm:flex-none px-5 py-2.5 rounded-full border border-[#24252c]/20 text-xs font-bold text-[var(--ink)] hover:bg-[#EEEEEE] transition-colors cursor-pointer"
              >
                Close
              </button>

              {mediaPickerTarget === 'gallery' && (
                <button
                  type="button"
                  onClick={handleAddSelectedMediaToGallery}
                  disabled={selectedMediaForGallery.length === 0}
                  className="flex-1 sm:flex-none px-6 py-2.5 rounded-full bg-[#1090F8] hover:bg-[#0b7cd0] text-white text-xs font-bold transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <IconPlus className="w-4 h-4" />
                  <span>Add Selected ({selectedMediaForGallery.length}) to Gallery</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </ModalOverlay>
    </div>
  );
}
