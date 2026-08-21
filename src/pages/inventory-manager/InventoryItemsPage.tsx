import { useState, useEffect } from 'react';
import type { Page } from '../../types';
import { EmptyState } from '../../components/shared/EmptyState';
import { MonoBadge } from '../../components/shared/Badges';
import {
  IconBox,
  IconX,
  IconChevronDown,
  IconChevronUp,
  IconSearch,
  IconPlus,
  IconPrinter,
} from '../../components/shared/icons';
import { ModalOverlay } from '../../components/shared/ModalOverlay';
import { supabase } from '../../lib/supabase';

const inputClass =
  'w-full rounded-full border px-4 py-2.5 text-xs bg-[#EEEEEE] text-[var(--ink)] placeholder:text-[#24252c]/40 focus:outline-none focus:border-[#1090F8] border-transparent transition-colors';

export type PhysicalUnitCondition =
  | 'Operational (Good)'
  | 'Minor Wear'
  | 'Needs Inspection'
  | 'In Repair';

export type PhysicalUnitStatus =
  | 'Available in Warehouse'
  | 'Decommissioned / Inactive'
  | 'Maintenance / Repair';

export interface PhysicalUnit {
  serialId: string;
  condition: PhysicalUnitCondition;
  status: PhysicalUnitStatus;
  lastMaintenance: string;
  notes?: string;
}

export interface MasterEquipmentModel {
  modelId: string;
  name: string;
  brand: string;
  category: string;
  desc: string;
  img: string;
  rentalRate: number;
  units: PhysicalUnit[];
}

// Helper: Dynamically generate Serial ID Prefix Tag based on Brand & Equipment Name
const getSerialPrefix = (name: string, brand: string, category: string): string => {
  const cleanBrand = (brand || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 3);
  const cleanName = (name || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 3);
  const cleanCat = (category || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 3);

  if (cleanBrand && cleanName) {
    return `${cleanBrand}-${cleanName}`;
  }
  if (cleanName) {
    return `${cleanCat || 'EQP'}-${cleanName}`;
  }
  return `${cleanCat || 'EQP'}-SYS`;
};

// Helper: Generates non-colliding serial tag IDs
const getNextSerialIds = (
  model: { name: string; brand: string; category: string; units: PhysicalUnit[] },
  allModels: MasterEquipmentModel[],
  count = 1
): string[] => {
  let prefix = getSerialPrefix(model.name, model.brand, model.category);
  if (model.units.length > 0 && model.units[0].serialId.includes('-')) {
    const parts = model.units[0].serialId.split('-');
    if (parts.length >= 2) {
      prefix = parts.slice(0, -1).join('-');
    }
  }

  const usedSerials = new Set<string>();
  allModels.forEach((m) => {
    m.units.forEach((u) => {
      usedSerials.add(u.serialId.toUpperCase());
    });
  });

  let maxNum = 0;
  const escapedPrefix = prefix.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp(`^${escapedPrefix}-(\\d+)$`, 'i');
  usedSerials.forEach((s) => {
    const match = s.match(regex);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  });

  const result: string[] = [];
  let current = maxNum + 1;
  while (result.length < count) {
    const candidate = `${prefix}-${String(current).padStart(3, '0')}`;
    if (!usedSerials.has(candidate.toUpperCase())) {
      result.push(candidate);
    }
    current++;
  }
  return result;
};

export default function InventoryItemsPage({ go: _go }: { go: (p: Page) => void }) {
  const [models, setModels] = useState<MasterEquipmentModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('All');
  const [expandedModelId, setExpandedModelId] = useState<string | null>(null);

  // Modals State
  const [showAddModelModal, setShowAddModelModal] = useState(false);
  const [editingModel, setEditingModel] = useState<MasterEquipmentModel | null>(null);
  const [selectedUnitForEdit, setSelectedUnitForEdit] = useState<{
    modelId: string;
    unit: PhysicalUnit;
  } | null>(null);
  const [deleteModelId, setDeleteModelId] = useState<string | null>(null);
  const [unitToDelete, setUnitToDelete] = useState<{ modelId: string; serialId: string } | null>(
    null
  );

  // Form State: Add Model
  const [addName, setAddName] = useState('');
  const [addBrand, setAddBrand] = useState('');
  const [addCat, setAddCat] = useState('Audio Production');
  const [addDesc, setAddDesc] = useState('');
  const [addRentalRate, setAddRentalRate] = useState<string>('500');
  const [addModelUnitQty, setAddModelUnitQty] = useState<string>('4');
  const [addFile, setAddFile] = useState<File | null>(null);
  const [addFilePreview, setAddFilePreview] = useState<string>('');
  const [addFormError, setAddFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State: Edit Model
  const [editName, setEditName] = useState('');
  const [editBrand, setEditBrand] = useState('');
  const [editCat, setEditCat] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editRentalRate, setEditRentalRate] = useState<string>('500');
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editFilePreview, setEditFilePreview] = useState<string>('');
  const [editFormError, setEditFormError] = useState('');

  const [isSubmittingUnitEdit, setIsSubmittingUnitEdit] = useState(false);
  const [isSubmittingUnitDelete, setIsSubmittingUnitDelete] = useState(false);

  // Form State: Edit Physical Unit
  const [unitEditSerialId, setUnitEditSerialId] = useState('');
  const [unitEditCondition, setUnitEditCondition] =
    useState<PhysicalUnitCondition>('Operational (Good)');
  const [unitEditStatus, setUnitEditStatus] =
    useState<PhysicalUnitStatus>('Available in Warehouse');
  const [unitEditLastMaint, setUnitEditLastMaint] = useState('');
  const [unitEditNotes, setUnitEditNotes] = useState('');
  const [unitEditError, setUnitEditError] = useState('');

  // Print Labels State
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printScope, setPrintScope] = useState<'all' | 'category' | 'model' | 'unit'>('all');
  const [printSelectedCat, setPrintSelectedCat] = useState<string>('All');
  const [selectedPrintModel, setSelectedPrintModel] = useState<MasterEquipmentModel | null>(null);
  const [selectedPrintUnit, setSelectedPrintUnit] = useState<PhysicalUnit | null>(null);

  const categories = [
    'All',
    'Audio Production',
    'Lighting',
    'Video & Visuals',
    'Stage Effects',
    'General',
  ];

  // Print units resolver
  const getUnitsToPrint = () => {
    if (printScope === 'unit' && selectedPrintModel && selectedPrintUnit) {
      return [{ model: selectedPrintModel, unit: selectedPrintUnit }];
    }

    if (printScope === 'model' && selectedPrintModel) {
      return selectedPrintModel.units.map((unit) => ({ model: selectedPrintModel, unit }));
    }

    const targetCat = printSelectedCat;
    const filteredModels =
      targetCat === 'All' ? models : models.filter((m) => m.category === targetCat);

    const list: { model: MasterEquipmentModel; unit: PhysicalUnit }[] = [];
    filteredModels.forEach((model) => {
      model.units.forEach((unit) => {
        list.push({ model, unit });
      });
    });
    return list;
  };

  const unitsToPrint = getUnitsToPrint();

  // Opens a clean new window with full standalone HTML and prints it
  const handlePrint = () => {
    const tags = getUnitsToPrint();
    if (tags.length === 0) return;

    const tagsHtml = tags
      .map(
        ({ model, unit }) => `
        <div class="tag-card">
          <div class="tag-header">
            <span class="brand-label">BINHI CONCEPT</span>
            <span class="brand-name">${model.brand}</span>
          </div>
          <div class="model-name">${model.name}</div>
          <div class="serial-box">
            <span class="serial-id">${unit.serialId}</span>
          </div>
          <div class="tag-footer">
            <span>ASSET PROPERTY</span>
            <span>${model.category}</span>
          </div>
        </div>`
      )
      .join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Serial Asset Tags &mdash; BINHI CONCEPT</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: portrait; margin: 8mm; }
    body { font-family: Arial, sans-serif; background: white; color: black; }
    .grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 4mm;
      width: 100%;
    }
    .tag-card {
      border: 1px solid #000;
      padding: 6px 8px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-height: 68px;
      page-break-inside: avoid;
      break-inside: avoid;
      background: white;
    }
    .tag-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #000;
      padding-bottom: 3px;
      margin-bottom: 4px;
    }
    .brand-label {
      font-size: 8px;
      font-weight: 900;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    .brand-name {
      font-size: 7px;
      font-family: monospace;
      text-transform: uppercase;
      max-width: 60px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .model-name {
      font-size: 9px;
      font-weight: 700;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 3px;
    }
    .serial-box {
      background: #f3f4f6;
      border: 1px solid rgba(0,0,0,0.35);
      text-align: center;
      padding: 3px 4px;
      margin-bottom: 4px;
    }
    .serial-id {
      font-family: monospace;
      font-weight: 900;
      font-size: 12px;
      letter-spacing: 0.15em;
      text-transform: uppercase;
    }
    .tag-footer {
      display: flex;
      justify-content: space-between;
      font-size: 7px;
      font-family: monospace;
      color: #555;
      letter-spacing: 0.04em;
    }
  </style>
</head>
<body>
  <div class="grid">
    ${tagsHtml}
  </div>
  <script>window.onload = function() { window.print(); window.onafterprint = function() { window.close(); }; }<\/script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (!win) { alert('Please allow pop-ups to print.'); return; }
    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  // Dynamic Prefix for the Add Modal form
  const dynamicAddPrefix = getSerialPrefix(addName, addBrand, addCat);

  // =========================================================================
  // SUPABASE READ (FETCH MODELS & PHYSICAL UNITS)
  // =========================================================================
  const fetchInventoryData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('equipment_models')
        .select('*, units:physical_units(*)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        const formatted: MasterEquipmentModel[] = data.map((m: any) => ({
          modelId: m.model_id,
          name: m.name,
          brand: m.brand,
          category: m.category,
          desc: m.description || '',
          img: m.image_url || '',
          rentalRate: Number(m.rental_rate) || 0,
          units: (m.units || []).map((u: any) => ({
            serialId: u.serial_id,
            condition: u.condition,
            status: u.status,
            lastMaintenance: u.last_maintenance,
            notes: u.notes,
          })),
        }));
        setModels(formatted);
        if (formatted.length > 0 && !expandedModelId) {
          setExpandedModelId(formatted[0].modelId);
        }
      } else {
        setModels([]);
      }
    } catch (err) {
      console.warn('Supabase fetch note:', err);
      setModels([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventoryData();
  }, []);

  // Helper: Upload File to Supabase Storage Bucket ('equipment-images')
  const uploadImageToSupabase = async (file: File): Promise<string> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
      const filePath = `equipment/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('equipment-images')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        console.warn('Supabase Storage Upload Warning:', uploadError);
        return '';
      }

      const { data } = supabase.storage
        .from('equipment-images')
        .getPublicUrl(filePath);

      return data.publicUrl || '';
    } catch (err) {
      console.error('Storage upload error:', err);
      return '';
    }
  };

  // Helper: Delete File from Supabase Storage Bucket ('equipment-images')
  const deleteImageFromSupabaseStorage = async (imageUrl: string) => {
    if (!imageUrl || !imageUrl.includes('equipment-images/')) return;
    try {
      const parts = imageUrl.split('equipment-images/');
      if (parts.length >= 2) {
        const filePath = parts[1];
        const { error } = await supabase.storage
          .from('equipment-images')
          .remove([filePath]);
        if (error) {
          console.warn('Supabase Storage file deletion note:', error);
        }
      }
    } catch (err) {
      console.warn('Error removing file from storage:', err);
    }
  };

  // Helper: Log to Supabase Audit Logs Table
  const logAuditToSupabase = async (
    action: string,
    targetId: string,
    details: string
  ) => {
    try {
      await supabase.from('audit_logs').insert({
        action,
        module: 'inventory',
        target_id: targetId,
        details,
        user_role: 'inventory_manager',
      });
    } catch (err) {
      console.warn('Audit log insert note:', err);
    }
  };

  const filteredModels = models.filter((m) => {
    const matchesCat = selectedCat === 'All' || m.category === selectedCat;
    const matchesSearch =
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.brand.toLowerCase().includes(search.toLowerCase()) ||
      m.modelId.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  // =========================================================================
  // SUPABASE CREATE (ADD MODEL & UNITS)
  // =========================================================================
  const handleAddModel = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddFormError('');

    if (!addName.trim()) {
      setAddFormError('Equipment Name is required.');
      return;
    }
    const qty = parseInt(addModelUnitQty, 10);
    if (isNaN(qty) || qty < 1) {
      setAddFormError('Initial Physical Units Qty must be at least 1.');
      return;
    }

    setIsSubmitting(true);

    try {
      let imageUrl = '';
      if (addFile) {
        imageUrl = await uploadImageToSupabase(addFile);
      }

      const cleanPrefix = dynamicAddPrefix;
      const modelId = `MOD-${cleanPrefix}-${Date.now().toString().slice(-4)}`;

      const newModel: MasterEquipmentModel = {
        modelId,
        name: addName.trim(),
        brand: addBrand.trim() || 'BINHI Standard',
        category: addCat,
        desc: addDesc.trim() || 'Professional event production equipment model.',
        img: imageUrl,
        rentalRate: Number(addRentalRate) || 0,
        units: [],
      };

      // 1. Insert Model into Supabase DB
      const { error: modelError } = await supabase.from('equipment_models').insert({
        model_id: modelId,
        name: newModel.name,
        brand: newModel.brand,
        category: newModel.category,
        description: newModel.desc,
        image_url: newModel.img,
        rental_rate: newModel.rentalRate,
      });

      if (modelError) {
        console.warn('Supabase DB Insert Model Note:', modelError);
      }

      // 2. Insert Physical Units into Supabase DB
      const initialSerialIds = getNextSerialIds(
        { name: newModel.name, brand: newModel.brand, category: newModel.category, units: [] },
        models,
        qty
      );

      const generatedUnits: PhysicalUnit[] = initialSerialIds.map((sid) => ({
        serialId: sid,
        condition: 'Operational (Good)' as PhysicalUnitCondition,
        status: 'Available in Warehouse' as PhysicalUnitStatus,
        lastMaintenance: new Date().toISOString().split('T')[0],
      }));

      newModel.units = generatedUnits;

      const unitsInsertPayload = generatedUnits.map((u) => ({
        model_id: modelId,
        serial_id: u.serialId,
        condition: u.condition,
        status: u.status,
        last_maintenance: u.lastMaintenance,
      }));

      const { error: unitsError } = await supabase
        .from('physical_units')
        .insert(unitsInsertPayload);

      if (unitsError) {
        console.warn('Supabase DB Insert Units Note:', unitsError);
      }

      // 3. Log Audit Trail
      await logAuditToSupabase(
        'ADD_EQUIPMENT_MODEL',
        modelId,
        `Created model ${newModel.name} with ${qty} physical units (Prefix: ${cleanPrefix})`
      );

      // Update Local State
      setModels([newModel, ...models]);
      setExpandedModelId(modelId);

      // Reset Form State
      setShowAddModelModal(false);
      setAddName('');
      setAddBrand('');
      setAddDesc('');
      setAddModelUnitQty('4');
      setAddFile(null);
      setAddFilePreview('');
      window.dispatchEvent(new Event('inventory-updated'));
      setAddFile(null);
      setAddFilePreview('');
      window.dispatchEvent(new Event('inventory-updated'));
    } catch (err: any) {
      setAddFormError(err.message || 'An error occurred while creating equipment model.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // =========================================================================
  // SUPABASE UPDATE (EDIT MODEL)
  // =========================================================================
  const handleOpenEditModelModal = (model: MasterEquipmentModel) => {
    setEditingModel(model);
    setEditName(model.name);
    setEditBrand(model.brand);
    setEditCat(model.category);
    setEditDesc(model.desc);
    setEditRentalRate(String(model.rentalRate || 0));
    setEditFile(null);
    setEditFilePreview(model.img);
    setEditFormError('');
  };

  const handleSaveModelEdits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingModel) return;
    setEditFormError('');

    if (!editName.trim()) {
      setEditFormError('Equipment Name is required.');
      return;
    }

    setIsSubmitting(true);

    try {
      let imageUrl = editFilePreview;

      // Delete old photo from Supabase Storage if user removed it or uploaded a new replacement
      if (editingModel.img && (editFile || !editFilePreview)) {
        await deleteImageFromSupabaseStorage(editingModel.img);
      }

      if (editFile) {
        imageUrl = await uploadImageToSupabase(editFile);
      }

      const updatedModel: MasterEquipmentModel = {
        ...editingModel,
        name: editName.trim(),
        brand: editBrand.trim() || 'BINHI Standard',
        category: editCat,
        desc: editDesc.trim(),
        img: imageUrl,
        rentalRate: Number(editRentalRate) || 0,
      };

      // Update Supabase DB
      const { error: updateError } = await supabase
        .from('equipment_models')
        .update({
          name: updatedModel.name,
          brand: updatedModel.brand,
          category: updatedModel.category,
          description: updatedModel.desc,
          image_url: updatedModel.img,
          rental_rate: updatedModel.rentalRate,
        })
        .eq('model_id', editingModel.modelId);

      if (updateError) {
        console.warn('Supabase DB Update Model Note:', updateError);
      }

      await logAuditToSupabase(
        'EDIT_EQUIPMENT_MODEL',
        editingModel.modelId,
        `Updated specifications for model ${updatedModel.name}`
      );

      // Update Local State
      setModels((prev) =>
        prev.map((m) => (m.modelId === editingModel.modelId ? updatedModel : m))
      );

      setEditingModel(null);
      window.dispatchEvent(new Event('inventory-updated'));
    } catch (err: any) {
      setEditFormError(err.message || 'Failed to update equipment model.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // =========================================================================
  // SUPABASE DELETE (DELETE MODEL)
  // =========================================================================
  const handleConfirmDeleteModel = async (modelId: string) => {
    const target = models.find((m) => m.modelId === modelId);

    try {
      // Delete model image from Supabase Storage if present
      if (target?.img) {
        await deleteImageFromSupabaseStorage(target.img);
      }

      const { error: deleteError } = await supabase
        .from('equipment_models')
        .delete()
        .eq('model_id', modelId);

      if (deleteError) {
        console.warn('Supabase DB Delete Model Note:', deleteError);
      }

      await logAuditToSupabase(
        'DELETE_EQUIPMENT_MODEL',
        modelId,
        `Deleted model ${target?.name || modelId} and its physical units`
      );
    } catch (err) {
      console.warn('Delete model error:', err);
    }

    setModels((prev) => prev.filter((m) => m.modelId !== modelId));
    setDeleteModelId(null);
    window.dispatchEvent(new Event('inventory-updated'));
  };

  // =========================================================================
  // SUPABASE CREATE PHYSICAL UNIT (1-CLICK DIRECT ADD)
  // =========================================================================
  const handleAddUnitToModel = async (modelId: string) => {
    const targetModel = models.find((m) => m.modelId === modelId);
    if (!targetModel) return;

    // Smart auto-generation of unique non-colliding serial tag
    const suggestedIds = getNextSerialIds(targetModel, models, 1);
    const newUnitId = suggestedIds[0];

    const newUnit: PhysicalUnit = {
      serialId: newUnitId,
      condition: 'Operational (Good)',
      status: 'Available in Warehouse',
      lastMaintenance: new Date().toISOString().split('T')[0],
    };

    try {
      const { error: unitInsertError } = await supabase.from('physical_units').insert({
        model_id: modelId,
        serial_id: newUnit.serialId,
        condition: newUnit.condition,
        status: newUnit.status,
        last_maintenance: newUnit.lastMaintenance,
      });

      if (unitInsertError) {
        console.error('Supabase DB Insert Unit Error:', unitInsertError);
        alert(`Failed to add unit to database: ${unitInsertError.message}`);
        return;
      }

      await logAuditToSupabase(
        'ADD_PHYSICAL_UNIT',
        newUnitId,
        `Added unit ${newUnitId} to model ${modelId}`
      );

      // Update Local State
      setModels((prev) =>
        prev.map((m) => (m.modelId === modelId ? { ...m, units: [...m.units, newUnit] } : m))
      );
      window.dispatchEvent(new Event('inventory-updated'));
    } catch (err: any) {
      console.error('Add unit error:', err);
      alert(`Error adding physical unit: ${err.message}`);
    }
  };

  // =========================================================================
  // SUPABASE UPDATE PHYSICAL UNIT
  // =========================================================================
  const handleOpenEditUnitModal = (modelId: string, unit: PhysicalUnit) => {
    setSelectedUnitForEdit({ modelId, unit });
    setUnitEditSerialId(unit.serialId);
    setUnitEditCondition(unit.condition);
    setUnitEditStatus(unit.status);
    setUnitEditLastMaint(unit.lastMaintenance || new Date().toISOString().split('T')[0]);
    setUnitEditNotes(unit.notes || '');
    setUnitEditError('');
  };

  const handleSaveUnitEdits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnitForEdit) return;

    if (!unitEditSerialId.trim()) {
      setUnitEditError('Serial ID Tag is required.');
      return;
    }

    const { modelId, unit } = selectedUnitForEdit;
    const cleanSerialId = unitEditSerialId.trim().toUpperCase();

    // Check duplicate serial ID if serial tag was modified
    if (cleanSerialId !== unit.serialId.toUpperCase()) {
      const usedSerials = new Set<string>();
      models.forEach((m) =>
        m.units.forEach((u) => {
          if (u.serialId.toUpperCase() !== unit.serialId.toUpperCase()) {
            usedSerials.add(u.serialId.toUpperCase());
          }
        })
      );
      if (usedSerials.has(cleanSerialId)) {
        setUnitEditError(`Serial ID Tag "${cleanSerialId}" is already taken by another unit.`);
        return;
      }
    }

    setIsSubmittingUnitEdit(true);

    try {
      const { error: updateUnitError } = await supabase
        .from('physical_units')
        .update({
          serial_id: cleanSerialId,
          condition: unitEditCondition,
          status: unitEditStatus,
          last_maintenance: unitEditLastMaint,
          notes: unitEditNotes.trim() || null,
        })
        .eq('serial_id', unit.serialId);

      if (updateUnitError) {
        console.error('Supabase DB Update Unit Error:', updateUnitError);
        throw new Error(updateUnitError.message || 'Failed to update physical unit.');
      }

      await logAuditToSupabase(
        'EDIT_PHYSICAL_UNIT',
        cleanSerialId,
        `Updated unit status to ${unitEditStatus} and condition to ${unitEditCondition}`
      );

      setModels((prev) =>
        prev.map((m) => {
          if (m.modelId === modelId) {
            return {
              ...m,
              units: m.units.map((u) =>
                u.serialId === unit.serialId
                  ? {
                      ...u,
                      serialId: cleanSerialId,
                      condition: unitEditCondition,
                      status: unitEditStatus,
                      lastMaintenance: unitEditLastMaint,
                      notes: unitEditNotes.trim() || undefined,
                    }
                  : u
              ),
            };
          }
          return m;
        })
      );

      setSelectedUnitForEdit(null);
      window.dispatchEvent(new Event('inventory-updated'));
    } catch (err: any) {
      setUnitEditError(err.message || 'Failed to update physical unit.');
    } finally {
      setIsSubmittingUnitEdit(false);
    }
  };

  // =========================================================================
  // SUPABASE DELETE PHYSICAL UNIT
  // =========================================================================
  const handleConfirmRemoveUnit = async () => {
    if (!unitToDelete) return;
    const { modelId, serialId } = unitToDelete;

    setIsSubmittingUnitDelete(true);

    try {
      const { error: deleteUnitError } = await supabase
        .from('physical_units')
        .delete()
        .eq('serial_id', serialId);

      if (deleteUnitError) {
        console.error('Supabase DB Delete Unit Error:', deleteUnitError);
        throw new Error(deleteUnitError.message || 'Failed to delete unit from database.');
      }

      await logAuditToSupabase(
        'REMOVE_PHYSICAL_UNIT',
        serialId,
        `Removed physical unit ${serialId} from model ${modelId}`
      );

      setModels((prev) =>
        prev.map((m) => {
          if (m.modelId === modelId) {
            return {
              ...m,
              units: m.units.filter((u) => u.serialId !== serialId),
            };
          }
          return m;
        })
      );

      setUnitToDelete(null);
      window.dispatchEvent(new Event('inventory-updated'));
    } catch (err: any) {
      alert(`Could not remove physical unit: ${err.message}`);
    } finally {
      setIsSubmittingUnitDelete(false);
    }
  };

  // Handle File Input Change
  const handleImageFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    isEdit: boolean
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      const previewUrl = URL.createObjectURL(file);
      if (isEdit) {
        setEditFile(file);
        setEditFilePreview(previewUrl);
      } else {
        setAddFile(file);
        setAddFilePreview(previewUrl);
      }
    }
  };

  const deleteTargetModel = models.find((m) => m.modelId === deleteModelId);

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#24252c]/[0.06]">
        <div>
          <MonoBadge icon={IconBox}>Multi-Layer Inventory</MonoBadge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-1.5">
            Equipment Models & Physical Units
          </h1>
          <p className="text-xs text-[#24252c]/60 mt-1">
            Layer 1: Master Equipment Models & Specifications. Layer 2: Physical Serial Tag Roster.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto flex-wrap">
          <button
            onClick={() => {
              setPrintScope('all');
              setSelectedPrintModel(null);
              setSelectedPrintUnit(null);
              setShowPrintModal(true);
            }}
            className="bg-white text-[var(--ink)] border border-[#24252c]/15 text-xs font-bold px-4 py-2.5 rounded-full hover:bg-[var(--mist)] transition-all shadow-sm flex items-center gap-2 cursor-pointer"
            title="Print serial number stickers for equipment physical units"
          >
            <IconPrinter className="w-4 h-4 text-[#1090F8]" /> Print Serial Labels
          </button>

          <button
            onClick={() => setShowAddModelModal(true)}
            className="bg-[#1090F8] text-white text-xs font-bold px-5 py-2.5 rounded-full hover:bg-[#1090F8]/90 transition-all shadow-md flex items-center gap-2 cursor-pointer"
          >
            <IconPlus className="w-4 h-4" /> Add Equipment Model
          </button>
        </div>
      </div>

      {/* Category Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#24252c]/[0.08] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCat(cat)}
              className={`text-xs px-3.5 py-1.5 rounded-full font-medium transition-all cursor-pointer ${
                selectedCat === cat
                  ? 'bg-[var(--ink)] text-white shadow-sm font-semibold'
                  : 'bg-[var(--mist)] text-[#24252c]/60 hover:text-[var(--ink)]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <IconSearch className="w-4 h-4 text-[#24252c]/40 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search model, brand, or ID..."
            className={inputClass + ' pl-10'}
          />
        </div>
      </div>

      {/* Equipment Models Accordion List / Empty State */}
      {loading ? (
        <div className="bg-white rounded-2xl p-12 text-center text-xs text-[#24252c]/50 border border-[#24252c]/[0.08]">
          Fetching equipment inventory from database...
        </div>
      ) : filteredModels.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#24252c]/[0.08] shadow-sm p-8 text-center">
          <EmptyState
            icon={IconBox}
            title="No Equipment Models Found"
            description="No equipment models or physical units registered yet. Click '+ Add Equipment Model' above to create your first equipment line."
          />
        </div>
      ) : (
        <div className="space-y-4">
          {filteredModels.map((model) => {
            const isExpanded = expandedModelId === model.modelId;
            const totalUnits = model.units.length;
            const availableUnits = model.units.filter(
              (u) => u.status === 'Available in Warehouse'
            ).length;
            const inactiveUnits = model.units.filter(
              (u) => u.status === 'Decommissioned / Inactive' || u.status === 'Maintenance / Repair'
            ).length;

            return (
              <div
                key={model.modelId}
                className="bg-white rounded-2xl border border-[#24252c]/[0.08] shadow-sm overflow-hidden transition-all"
              >
                {/* Layer 1: Model Header Bar - Restored Compact Image Container */}
                <div
                  onClick={() => setExpandedModelId(isExpanded ? null : model.modelId)}
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-[var(--mist)] transition-colors"
                >
                  <div className="flex items-center gap-4">
                    {model.img ? (
                      <img
                        src={model.img}
                        alt={model.name}
                        className="w-14 h-14 rounded-2xl object-cover border border-[#24252c]/10 shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-[#EEEEEE] border border-[#24252c]/10 flex items-center justify-center text-[#1090F8] shrink-0 shadow-sm">
                        <IconBox className="w-7 h-7" />
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-[#1090F8]">
                          {model.modelId}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-[var(--mist)] px-2.5 py-0.5 rounded-full border border-[#24252c]/10">
                          {model.brand}
                        </span>
                        <span className="text-[10px] font-extrabold tracking-wider bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full border border-emerald-200 shadow-2xs">
                          ₱{(model.rentalRate || 0).toLocaleString()} / day
                        </span>
                      </div>
                      <h3 className="font-extrabold text-lg text-[var(--ink)] mt-0.5">
                        {model.name}
                      </h3>
                      <p className="text-xs text-[#24252c]/60 mt-0.5">{model.desc}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0 justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-[#24252c]/[0.06]">
                    <div className="text-right">
                      <div className="text-xs font-bold text-[var(--ink)]">
                        {totalUnits} Physical Units
                      </div>
                      <div className="text-[11px] text-[#24252c]/60 mt-0.5">
                        <span className="text-emerald-600 font-semibold">
                          {availableUnits} Available
                        </span>
                        {inactiveUnits > 0 && (
                          <span className="text-rose-600 font-semibold">
                            {' '}
                            · {inactiveUnits} Inactive/Repair
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEditModelModal(model);
                      }}
                      className="text-xs font-bold px-4 py-2 rounded-full bg-[var(--mist)] border border-[#24252c]/10 hover:bg-[var(--ink)] hover:text-white transition-colors cursor-pointer"
                    >
                      Edit Model
                    </button>

                    <div className="p-2 rounded-full bg-[var(--mist)] text-[var(--ink)]">
                      {isExpanded ? (
                        <IconChevronUp className="w-4 h-4" />
                      ) : (
                        <IconChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Layer 2: Physical Serial Roster Accordion */}
                {isExpanded && (
                  <div className="bg-[var(--mist)] p-5 border-t border-[#24252c]/[0.08] animate-blur-in">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#24252c]/60">
                        Layer 2: Registered Physical Units ({model.units.length} Serial Tags)
                      </h4>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setPrintScope('model');
                            setSelectedPrintModel(model);
                            setSelectedPrintUnit(null);
                            setShowPrintModal(true);
                          }}
                          className="bg-white border border-[#24252c]/10 text-xs font-bold px-3.5 py-1.5 rounded-full hover:bg-[var(--ink)] hover:text-white transition-colors shadow-sm cursor-pointer flex items-center gap-1.5"
                          title="Print serial stickers for all units of this model"
                        >
                          <IconPrinter className="w-3.5 h-3.5" /> Print Tags
                        </button>
                        <button
                          onClick={() => handleAddUnitToModel(model.modelId)}
                          className="bg-white border border-[#24252c]/10 text-xs font-bold px-3.5 py-1.5 rounded-full hover:bg-[var(--ink)] hover:text-white transition-colors shadow-sm cursor-pointer flex items-center gap-1.5"
                        >
                          + Add Physical Unit
                        </button>
                        <button
                          onClick={() => setDeleteModelId(model.modelId)}
                          className="bg-rose-50 text-rose-600 border border-rose-200 text-xs font-semibold px-3.5 py-1.5 rounded-full hover:bg-rose-100 transition-colors cursor-pointer"
                        >
                          Delete Model
                        </button>
                      </div>
                    </div>

                    {model.units.length === 0 ? (
                      <div className="bg-white/80 rounded-2xl border border-dashed border-[#24252c]/15 p-6 text-center">
                        <p className="text-xs text-[#24252c]/60 font-medium mb-3">
                          No physical serial tags registered for this model yet.
                        </p>
                        <button
                          onClick={() => handleAddUnitToModel(model.modelId)}
                          className="bg-[#1090F8] text-white text-xs font-bold px-4 py-2 rounded-full hover:bg-[#1090F8]/90 transition-all shadow-md inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          + Add Physical Unit
                        </button>
                      </div>
                    ) : (
                      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {model.units.map((unit) => (
                          <div
                            key={unit.serialId}
                            className="bg-white p-4 rounded-xl border border-[#24252c]/[0.08] shadow-sm flex flex-col justify-between"
                          >
                            <div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-mono font-extrabold text-[#1090F8]">
                                  {unit.serialId}
                                </span>
                                <span
                                  className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                    unit.condition === 'Operational (Good)'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : unit.condition === 'In Repair'
                                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                                  }`}
                                >
                                  {unit.condition}
                                </span>
                              </div>

                              <div className="text-xs font-bold text-[var(--ink)] mt-2">
                                {unit.status}
                              </div>
                              <div className="text-[10px] text-[#24252c]/50 mt-1">
                                Last Inspection: {unit.lastMaintenance}
                              </div>
                              {unit.notes && (
                                <div className="text-[10px] text-amber-600 mt-1 italic">
                                  "{unit.notes}"
                                </div>
                              )}
                            </div>

                            <div className="mt-3 pt-2 border-t border-[#24252c]/[0.06] flex items-center gap-2">
                              <button
                                onClick={() => handleOpenEditUnitModal(model.modelId, unit)}
                                className="flex-1 bg-[var(--mist)] text-[var(--ink)] text-[11px] font-semibold py-1.5 rounded-lg border border-[#24252c]/10 hover:bg-[#1090F8] hover:text-white transition-colors cursor-pointer"
                              >
                                Edit Serial & Status
                              </button>
                              <button
                                onClick={() => {
                                  setPrintScope('unit');
                                  setSelectedPrintModel(model);
                                  setSelectedPrintUnit(unit);
                                  setShowPrintModal(true);
                                }}
                                title="Print Serial Tag Sticker for this unit"
                                className="bg-sky-50 text-sky-700 hover:bg-sky-600 hover:text-white text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-sky-200 transition-colors cursor-pointer shrink-0 flex items-center gap-1"
                              >
                                <IconPrinter className="w-3.5 h-3.5" /> Tag
                              </button>
                              <button
                                onClick={() =>
                                  setUnitToDelete({ modelId: model.modelId, serialId: unit.serialId })
                                }
                                title="Remove Unit"
                                className="bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-rose-200 transition-colors cursor-pointer shrink-0"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* UNIFORM ADD MASTER MODEL MODAL (FULL CONTAINER PREVIEW IN MODAL) */}
      {/* ========================================================================= */}
      <ModalOverlay isOpen={showAddModelModal} onClose={() => setShowAddModelModal(false)}>
        <div className="bg-white rounded-[2.5rem] p-6 md:p-10 max-w-5xl w-full shadow-2xl border border-[#24252c]/10 relative">
          <button
            onClick={() => setShowAddModelModal(false)}
            className="absolute top-6 right-6 text-[#24252c]/50 hover:text-[var(--ink)] p-1.5 cursor-pointer"
          >
            <IconX className="w-6 h-6" />
          </button>
          <h3 className="text-2xl font-extrabold text-[var(--ink)] mb-1">
            Add Master Equipment Model
          </h3>
          <p className="text-xs text-[#24252c]/60 mb-6">
            Create a new equipment line and automatically provision serial-tracked physical units.
          </p>

          {addFormError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
              {addFormError}
            </div>
          )}

          <form onSubmit={handleAddModel} className="space-y-5 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column Fields */}
              <div className="space-y-4">
                <div>
                  <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">
                    Equipment Name *
                  </label>
                  <input
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    placeholder="e.g. Yamaha DBR12 Speaker / Chauvet Light"
                    className={inputClass + ' py-3'}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">
                      Brand Name
                    </label>
                    <input
                      value={addBrand}
                      onChange={(e) => setAddBrand(e.target.value)}
                      placeholder="e.g. Yamaha / Chauvet / Pioneer"
                      className={inputClass + ' py-3'}
                    />
                  </div>
                  <div>
                    <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">
                      Category
                    </label>
                    <select
                      value={addCat}
                      onChange={(e) => setAddCat(e.target.value)}
                      className={inputClass + ' py-3 font-semibold'}
                    >
                      <option>Audio Production</option>
                      <option>Lighting</option>
                      <option>Video & Visuals</option>
                      <option>Stage Effects</option>
                      <option>General</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">
                      Initial Qty *
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={addModelUnitQty}
                      onChange={(e) => setAddModelUnitQty(e.target.value)}
                      onKeyDown={(e) => {
                        if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
                      }}
                      className={inputClass + ' py-3'}
                      required
                    />
                  </div>
                  <div>
                    <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">
                      Rate (₱ / Day) *
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={addRentalRate}
                      onChange={(e) => setAddRentalRate(e.target.value)}
                      onKeyDown={(e) => {
                        if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
                      }}
                      placeholder="e.g. 500"
                      className={inputClass + ' py-3 font-bold text-[#1090F8]'}
                      required
                    />
                  </div>
                  <div>
                    <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">
                      Serial Prefix
                    </label>
                    <input
                      value={dynamicAddPrefix}
                      readOnly
                      disabled
                      className={inputClass + ' py-3 uppercase font-mono font-bold text-[#1090F8] opacity-80 cursor-not-allowed'}
                      title="Serial ID Prefix Tag is dynamically generated based on Brand & Equipment Name"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">
                    Description & Specifications
                  </label>
                  <textarea
                    rows={4}
                    value={addDesc}
                    onChange={(e) => setAddDesc(e.target.value)}
                    placeholder="Inclusions, wattage, dimensions..."
                    className="w-full rounded-2xl border px-4 py-3 bg-[#EEEEEE] focus:outline-none focus:border-[#1090F8] border-transparent transition-colors leading-relaxed"
                  />
                </div>
              </div>

              {/* Right Column: File Upload Only with Full Container Preview */}
              <div className="space-y-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold uppercase text-[#24252c]/50 block">
                      Equipment Photo Upload
                    </label>
                    <span className="text-[10px] text-[#24252c]/40 font-medium">Optional</span>
                  </div>

                  <div className="w-full min-h-[220px] rounded-2xl border-2 border-dashed border-[#24252c]/20 bg-[#EEEEEE] p-3 text-center flex flex-col items-center justify-center relative hover:border-[#1090F8] transition-all group overflow-hidden">
                    {addFilePreview ? (
                      <div className="w-full h-full relative group/preview">
                        <img
                          src={addFilePreview}
                          alt="Preview"
                          className="w-full h-48 object-cover rounded-xl border border-[#24252c]/10 shadow-sm"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/preview:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => {
                              setAddFile(null);
                              setAddFilePreview('');
                            }}
                            className="bg-rose-600 text-white text-xs font-bold px-4 py-2 rounded-full shadow-md hover:bg-rose-700 transition-colors z-20 cursor-pointer"
                          >
                            Delete Photo
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <span className="w-10 h-10 rounded-full bg-white text-[#1090F8] flex items-center justify-center mb-2 shadow-sm group-hover:scale-110 transition-transform">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                        </span>
                        <p className="text-xs font-bold text-[var(--ink)]">
                          Click or Drag Image File to Upload
                        </p>
                        <p className="text-[10px] text-[#24252c]/50 mt-1">
                          PNG, JPG, WEBP (Optional). An equipment icon is used if omitted.
                        </p>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleImageFileChange(e, false)}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                      </>
                    )}
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-[var(--ink)] text-white font-bold py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors cursor-pointer text-xs shadow-lg disabled:opacity-50"
                  >
                    {isSubmitting
                      ? 'Saving to Database...'
                      : '+ Save Equipment Model & Provision Units'}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </ModalOverlay>

      {/* ========================================================================= */}
      {/* UNIFORM EDIT MASTER MODEL MODAL WITH STORAGE FILE DELETION */}
      {/* ========================================================================= */}
      <ModalOverlay isOpen={!!editingModel} onClose={() => setEditingModel(null)}>
        <div className="bg-white rounded-[2.5rem] p-6 md:p-10 max-w-5xl w-full shadow-2xl border border-[#24252c]/10 relative">
          <button
            onClick={() => setEditingModel(null)}
            className="absolute top-6 right-6 text-[#24252c]/50 hover:text-[var(--ink)] p-1.5 cursor-pointer"
          >
            <IconX className="w-6 h-6" />
          </button>
          <h3 className="text-2xl font-extrabold text-[var(--ink)] mb-1">
            Edit Master Equipment Model
          </h3>
          <p className="text-xs font-mono font-bold text-[#1090F8] mb-6">
            Model ID: {editingModel?.modelId}
          </p>

          {editFormError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
              {editFormError}
            </div>
          )}

          <form onSubmit={handleSaveModelEdits} className="space-y-5 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column Fields */}
              <div className="space-y-4">
                <div>
                  <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">
                    Equipment Name *
                  </label>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className={inputClass + ' py-3'}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">
                      Brand Name
                    </label>
                    <input
                      value={editBrand}
                      onChange={(e) => setEditBrand(e.target.value)}
                      className={inputClass + ' py-3'}
                    />
                  </div>
                  <div>
                    <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">
                      Category
                    </label>
                    <select
                      value={editCat}
                      onChange={(e) => setEditCat(e.target.value)}
                      className={inputClass + ' py-3 font-semibold'}
                    >
                      <option>Audio Production</option>
                      <option>Lighting</option>
                      <option>Video & Visuals</option>
                      <option>Stage Effects</option>
                      <option>General</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">
                    Model Rental Rate (₱ / Day) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editRentalRate}
                    onChange={(e) => setEditRentalRate(e.target.value)}
                    onKeyDown={(e) => {
                      if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
                    }}
                    placeholder="e.g. 500"
                    className={inputClass + ' py-3 font-bold text-[#1090F8]'}
                    required
                  />
                </div>

                <div>
                  <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">
                    Description & Specifications
                  </label>
                  <textarea
                    rows={5}
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="w-full rounded-2xl border px-4 py-3 bg-[#EEEEEE] focus:outline-none focus:border-[#1090F8] border-transparent transition-colors leading-relaxed"
                  />
                </div>
              </div>

              {/* Right Column: File Upload with Storage Deletion */}
              <div className="space-y-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold uppercase text-[#24252c]/50 block">
                      Equipment Photo Upload
                    </label>
                    {editFilePreview && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditFile(null);
                          setEditFilePreview('');
                        }}
                        className="text-[11px] text-rose-600 font-bold hover:underline cursor-pointer"
                      >
                        Delete Photo
                      </button>
                    )}
                  </div>

                  <div className="w-full min-h-[220px] rounded-2xl border-2 border-dashed border-[#24252c]/20 bg-[#EEEEEE] p-3 text-center flex flex-col items-center justify-center relative hover:border-[#1090F8] transition-all group overflow-hidden">
                    {editFilePreview ? (
                      <div className="w-full h-full relative group/preview">
                        <img
                          src={editFilePreview}
                          alt="Preview"
                          className="w-full h-48 object-cover rounded-xl border border-[#24252c]/10 shadow-sm"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/preview:opacity-100 transition-opacity rounded-xl flex flex-col items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditFile(null);
                              setEditFilePreview('');
                            }}
                            className="bg-rose-600 text-white text-xs font-bold px-4 py-2 rounded-full shadow-md hover:bg-rose-700 transition-colors z-20 cursor-pointer"
                          >
                            Delete Photo
                          </button>
                          <span className="text-[10px] text-white/80 font-medium">
                            Or click below box to replace image file
                          </span>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleImageFileChange(e, true)}
                          className="absolute inset-0 opacity-0 cursor-pointer z-10"
                        />
                      </div>
                    ) : (
                      <>
                        <div className="w-14 h-14 rounded-2xl bg-white border border-[#24252c]/10 flex items-center justify-center text-[#1090F8] mb-2 shadow-sm">
                          <IconBox className="w-7 h-7" />
                        </div>
                        <p className="text-xs font-bold text-[var(--ink)]">Click or Drag File to Upload Photo</p>
                        <p className="text-[10px] text-[#24252c]/50 mt-0.5">
                          PNG, JPG, or WEBP. Uploads directly to Supabase storage.
                        </p>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleImageFileChange(e, true)}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                      </>
                    )}
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-[var(--ink)] text-white font-bold py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors cursor-pointer text-xs shadow-lg disabled:opacity-50"
                  >
                    {isSubmitting ? 'Saving Changes...' : 'Save Equipment Model Details'}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </ModalOverlay>



      {/* ========================================================================= */}
      {/* EDIT INDIVIDUAL PHYSICAL UNIT SERIAL & STATUS MODAL */}
      {/* ========================================================================= */}
      <ModalOverlay isOpen={!!selectedUnitForEdit} onClose={() => setSelectedUnitForEdit(null)}>
        <div className="bg-white rounded-[2rem] p-6 max-w-lg w-full shadow-2xl border border-[#24252c]/10 relative">
          <button
            onClick={() => setSelectedUnitForEdit(null)}
            className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1 cursor-pointer"
          >
            <IconX className="w-5 h-5" />
          </button>
          <h3 className="text-xl font-extrabold text-[var(--ink)] mb-1">
            Edit Layer 2 Physical Serial Unit
          </h3>
          <p className="text-xs text-[#24252c]/50 mb-4">
            Modify unit serial tag, physical condition rating, or decommission status.
          </p>

          {unitEditError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
              {unitEditError}
            </div>
          )}

          <form onSubmit={handleSaveUnitEdits} className="space-y-4 text-xs">
            <div>
              <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">
                Physical Serial ID Tag *
              </label>
              <input
                value={unitEditSerialId}
                onChange={(e) => setUnitEditSerialId(e.target.value.toUpperCase())}
                className={inputClass + ' font-mono font-bold text-[#1090F8] py-3'}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">
                  Physical Condition
                </label>
                <select
                  value={unitEditCondition}
                  onChange={(e) => setUnitEditCondition(e.target.value as PhysicalUnitCondition)}
                  className={inputClass + ' font-semibold py-3'}
                >
                  <option>Operational (Good)</option>
                  <option>Minor Wear</option>
                  <option>Needs Inspection</option>
                  <option>In Repair</option>
                </select>
              </div>

              <div>
                <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">
                  Unit Status
                </label>
                <select
                  value={unitEditStatus}
                  onChange={(e) => setUnitEditStatus(e.target.value as PhysicalUnitStatus)}
                  className={inputClass + ' font-semibold py-3'}
                >
                  <option>Available in Warehouse</option>
                  <option>Decommissioned / Inactive</option>
                  <option>Maintenance / Repair</option>
                </select>
              </div>
            </div>

            <div>
              <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">
                Last Bench Inspection Date
              </label>
              <input
                type="date"
                value={unitEditLastMaint}
                onChange={(e) => setUnitEditLastMaint(e.target.value)}
                className={inputClass + ' py-3'}
              />
            </div>

            <div>
              <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">
                Maintenance / Repair Notes
              </label>
              <textarea
                rows={2}
                value={unitEditNotes}
                onChange={(e) => setUnitEditNotes(e.target.value)}
                placeholder="Notes about wear, repair parts, or decommissioning..."
                className="w-full rounded-2xl border px-4 py-2.5 bg-[#EEEEEE] focus:outline-none focus:border-[#1090F8] border-transparent transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmittingUnitEdit}
              className="w-full bg-[var(--ink)] text-white font-semibold py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSubmittingUnitEdit ? 'Saving Changes...' : 'Save Physical Unit Changes'}
            </button>
          </form>
        </div>
      </ModalOverlay>

      {/* ========================================================================= */}
      {/* CONFIRM DELETE MODEL MODAL */}
      {/* ========================================================================= */}
      <ModalOverlay isOpen={!!deleteModelId} onClose={() => setDeleteModelId(null)}>
        <div className="bg-white rounded-[2.5rem] p-6 md:p-8 max-w-lg w-full shadow-2xl border border-[#24252c]/10 relative text-center">
          <button
            onClick={() => setDeleteModelId(null)}
            className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1 cursor-pointer"
          >
            <IconX className="w-5 h-5" />
          </button>
          <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-600 font-extrabold text-2xl flex items-center justify-center mx-auto mb-4 border border-rose-200 shadow-sm">
            !
          </div>

          <h3 className="text-2xl font-extrabold text-[var(--ink)] mb-1">Delete Equipment Model</h3>
          <p className="text-xs font-mono font-bold text-[#1090F8] mb-3">
            {deleteTargetModel?.modelId} — {deleteTargetModel?.name}
          </p>

          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-left text-xs space-y-2 mb-6">
            <p className="font-bold text-rose-800 flex items-center gap-1.5">
              Permanent Deletion Warning
            </p>
            <p className="text-rose-700 text-[11px] leading-relaxed">
              By deleting this equipment model, you will permanently purge:
            </p>
            <ul className="list-disc list-inside text-[11px] text-rose-700 font-medium space-y-1">
              <li>
                <strong>{deleteTargetModel?.units.length || 0} registered physical serial units</strong>{' '}
                ({deleteTargetModel?.units.map((u) => u.serialId).join(', ') || 'No units'})
              </li>
              <li>All physical bench maintenance records and serial condition logs</li>
              <li>Master equipment specifications</li>
            </ul>
            <p className="text-[10px] text-rose-600 italic font-semibold pt-1">
              This action is immediate and cannot be undone.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <button
              onClick={() => setDeleteModelId(null)}
              className="flex-1 bg-[var(--mist)] text-[var(--ink)] font-semibold py-3.5 rounded-full border border-[#24252c]/10 hover:bg-[var(--ink)] hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => handleConfirmDeleteModel(deleteModelId || '')}
              className="flex-1 bg-rose-600 text-white font-extrabold py-3.5 rounded-full hover:bg-rose-700 transition-colors shadow-md cursor-pointer"
            >
              Yes, Delete Model
            </button>
          </div>
        </div>
      </ModalOverlay>

      {/* ========================================================================= */}
      {/* CONFIRM REMOVE INDIVIDUAL PHYSICAL UNIT MODAL */}
      {/* ========================================================================= */}
      <ModalOverlay isOpen={!!unitToDelete} onClose={() => setUnitToDelete(null)}>
        <div className="bg-white rounded-[2rem] p-6 max-w-md w-full shadow-2xl border border-[#24252c]/10 relative text-center">
          <button
            onClick={() => setUnitToDelete(null)}
            className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1 cursor-pointer"
          >
            <IconX className="w-5 h-5" />
          </button>
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 font-extrabold text-xl flex items-center justify-center mx-auto mb-3 border border-rose-200">
            !
          </div>

          <h3 className="text-xl font-extrabold text-[var(--ink)] mb-1">Remove Physical Unit</h3>
          <p className="text-xs text-[#24252c]/60 mb-4">
            Are you sure you want to remove physical unit{' '}
            <strong className="font-mono text-[#1090F8] font-bold">{unitToDelete?.serialId}</strong>{' '}
            from inventory?
          </p>

          <p className="text-[11px] text-rose-600 bg-rose-50 border border-rose-100 p-3 rounded-xl mb-5 text-left">
            This unit's serial tag will be decommissioned and removed from the active serial roster.
          </p>

          <div className="flex items-center gap-3 text-xs">
            <button
              onClick={() => setUnitToDelete(null)}
              className="flex-1 bg-[var(--mist)] text-[var(--ink)] font-semibold py-3 rounded-full border border-[#24252c]/10 hover:bg-[var(--ink)] hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmRemoveUnit}
              disabled={isSubmittingUnitDelete}
              className="flex-1 bg-rose-600 text-white font-semibold py-3 rounded-full hover:bg-rose-700 transition-colors shadow-md cursor-pointer disabled:opacity-50"
            >
              {isSubmittingUnitDelete ? 'Removing...' : 'Remove Unit'}
            </button>
          </div>
        </div>
      </ModalOverlay>

      {/* ========================================================================= */}
      {/* PRINT SERIAL LABELS MODAL */}
      {/* ========================================================================= */}

      <ModalOverlay isOpen={showPrintModal} onClose={() => setShowPrintModal(false)}>
        <div className="bg-white rounded-[2.5rem] p-6 md:p-8 max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-[#24252c]/10 text-left">

          {/* ── Modal Header ── */}
          <div className="mb-5 pb-4 border-b border-[#24252c]/[0.08]">

            {/* Row 1: Title + X button aligned right */}
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xl font-extrabold text-[var(--ink)] flex items-center gap-2 leading-tight">
                <IconPrinter className="w-5 h-5 text-[#1090F8] shrink-0" />
                Print Serial Asset Tags
              </h3>
              <button
                onClick={() => setShowPrintModal(false)}
                className="text-[#24252c]/40 hover:text-[var(--ink)] p-1.5 rounded-full hover:bg-[var(--mist)] transition-colors cursor-pointer shrink-0"
                title="Close"
              >
                <IconX className="w-5 h-5" />
              </button>
            </div>

            {/* Row 2: Subtitle */}
            <p className="text-xs text-[#24252c]/50 mt-1 ml-7">
              {unitsToPrint.length === 0
                ? 'No tags match the selected filter.'
                : `${unitsToPrint.length} tag${unitsToPrint.length !== 1 ? 's' : ''} queued`}
            </p>

            {/* Row 3: Pill filter bar + Print pill — all same height */}
            <div className="flex items-center gap-2 mt-4 flex-wrap">
              {/* Category Select — pill shaped */}
              <select
                value={printSelectedCat}
                onChange={(e) => {
                  setPrintSelectedCat(e.target.value);
                  setPrintScope('category');
                }}
                className="h-9 text-xs px-4 rounded-full border border-[#24252c]/15 bg-[var(--mist)] font-semibold text-[var(--ink)] cursor-pointer focus:outline-none focus:border-[#1090F8] transition-colors"
              >
                <option value="All">All Categories ({models.reduce((sum, m) => sum + m.units.length, 0)})</option>
                <option value="Audio Production">Audio Production</option>
                <option value="Lighting">Lighting</option>
                <option value="Video & Visuals">Video & Visuals</option>
                <option value="Stage Effects">Stage Effects</option>
                <option value="General">General</option>
              </select>

              {/* Model pill — only if a model is selected */}
              {selectedPrintModel && (
                <button
                  onClick={() => setPrintScope('model')}
                  className={`h-9 text-xs px-4 rounded-full font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    printScope === 'model'
                      ? 'bg-[var(--ink)] text-white'
                      : 'bg-[var(--mist)] text-[#24252c]/70 hover:text-[var(--ink)] border border-[#24252c]/10'
                  }`}
                >
                  {selectedPrintModel.name}
                </button>
              )}

              {/* Spacer pushes Print to the right */}
              <div className="flex-1" />

              {/* Print pill button */}
              <button
                onClick={handlePrint}
                disabled={unitsToPrint.length === 0}
                className="h-9 bg-[#1090F8] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-extrabold px-5 rounded-full hover:bg-[#1090F8]/90 transition-all shadow-sm flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <IconPrinter className="w-3.5 h-3.5" /> Print ({unitsToPrint.length})
              </button>
            </div>
          </div>

          {/* On-Screen Preview of Tags */}
          <div className="overflow-y-auto flex-1">
            {unitsToPrint.length === 0 ? (
              <div className="p-10 text-center text-[#24252c]/50 text-xs font-semibold bg-[var(--mist)] rounded-2xl">
                No physical unit serial tags match the selected category filter.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {unitsToPrint.map(({ model, unit }) => (
                  <div
                    key={unit.serialId}
                    className="border border-black/70 bg-white p-2.5 rounded-lg flex flex-col justify-between text-black select-none"
                    style={{ minHeight: '80px' }}
                  >
                    <div>
                      <div className="flex items-center justify-between border-b border-black pb-0.5 mb-1">
                        <span className="text-[8px] font-black tracking-wider uppercase">BINHI CONCEPT</span>
                        <span className="text-[7px] font-mono font-bold uppercase text-gray-600 truncate max-w-[55px]">{model.brand}</span>
                      </div>
                      <div className="text-[9px] font-bold truncate leading-tight">{model.name}</div>
                    </div>
                    <div className="bg-gray-100 border border-black/30 rounded text-center px-1 py-1 my-1">
                      <span className="text-[10px] font-mono font-black tracking-widest uppercase">{unit.serialId}</span>
                    </div>
                    <div className="flex justify-between text-[7px] font-mono text-gray-500">
                      <span>ASSET</span>
                      <span className="truncate max-w-[50px]">{model.category}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </ModalOverlay>
    </div>
  );
}
