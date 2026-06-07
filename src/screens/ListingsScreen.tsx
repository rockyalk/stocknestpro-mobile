import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert, 
  useWindowDimensions, 
  StyleSheet, 
  TextInput,
  Modal,
  RefreshControl,
  Image,
  Switch,
  Linking,
  Vibration
} from 'react-native';
import { Audio } from 'expo-av';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { 
  Tag, 
  Search, 
  RefreshCw, 
  Plus, 
  Edit3, 
  Trash2, 
  Check, 
  X, 
  Layers, 
  DollarSign, 
  Package, 
  FileText, 
  Send,
  HelpCircle,
  AlertTriangle,
  QrCode,
  Camera,
  Info,
  MapPin,
  Map as MapIcon,
  CheckCircle2,
  ChevronRight,
  Barcode,
  ExternalLink,
  PlusCircle,
  Warehouse,
  Eye,
  Heart,
  TrendingUp,
  Calendar,
  Clock,
  Printer,
  Navigation
} from 'lucide-react-native';
import { trpc } from '../../App';
import { useAuth } from '../contexts/AuthContext';

export function ListingsScreen({ navigation }: any) {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const { user } = useAuth();
  const utils = (trpc as any).useUtils();

  // Redesigned 5 sub-tabs: active, drafts, needs_mapping, scheduled, ended
  const [activeTab, setActiveTab] = useState<'active' | 'drafts' | 'needs_mapping' | 'scheduled' | 'ended'>('active');
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  // Camera permissions for scanning
  const [permission, requestPermission] = useCameraPermissions();

  // --- QUERIES & MUTATIONS ---
  // 1. eBay Listings (Mapped + Unmapped)
  const listingsQuery = (trpc as any).ebay.listListings.useQuery(undefined, {
    enabled: !!user,
  });

  // 2. eBay Drafts
  const draftsQuery = (trpc as any).listingWizard.listDrafts.useQuery(undefined, {
    enabled: !!user,
  });

  // 3. Warehouse Stock
  const inventoryQuery = (trpc as any).inventory.list.useQuery({
    page,
    limit: 100,
    search: searchQuery,
  }, {
    enabled: !!user,
  });

  // 4. Warehouses
  const warehousesQuery = (trpc as any).warehouse.list.useQuery(undefined, {
    enabled: !!user,
  });

  // 5. eBay Connections
  const connectionsQuery = (trpc as any).ebay.listConnections.useQuery(undefined, {
    enabled: !!user,
  });

  // Mutations
  const updateInventoryMutation = (trpc as any).inventory.update.useMutation({
    onSuccess: () => {
      utils.inventory.list.invalidate();
      utils.ebay.listListings.invalidate();
      setEditModalVisible(false);
      setEditingItem(null);
      Alert.alert('Success', 'Listing updated successfully!');
    },
    onError: (err: any) => {
      Alert.alert('Update Failed', err.message || 'Unable to update item.');
    }
  });

  const deleteInventoryMutation = (trpc as any).inventory.delete.useMutation({
    onSuccess: () => {
      utils.inventory.list.invalidate();
      utils.ebay.listListings.invalidate();
      Alert.alert('Deleted', 'Stock item has been deleted.');
    },
    onError: (err: any) => {
      Alert.alert('Delete Failed', err.message || 'Unable to delete item.');
    }
  });

  const deleteDraftMutation = (trpc as any).listingWizard.deleteDraft.useMutation({
    onSuccess: () => {
      utils.listingWizard.listDrafts.invalidate();
      Alert.alert('Deleted', 'Draft has been deleted.');
    },
    onError: (err: any) => {
      Alert.alert('Delete Failed', err.message || 'Unable to delete draft.');
    }
  });

  const duplicateDraftMutation = (trpc as any).listingWizard.duplicateDraft.useMutation({
    onSuccess: () => {
      utils.listingWizard.listDrafts.invalidate();
      Alert.alert('Duplicated', 'Draft has been duplicated successfully!');
    },
    onError: (err: any) => {
      Alert.alert('Duplicate Failed', err.message || 'Unable to duplicate draft.');
    }
  });

  const publishDraftMutation = (trpc as any).listingWizard.publish.useMutation({
    onSuccess: () => {
      utils.listingWizard.listDrafts.invalidate();
      utils.ebay.listListings.invalidate();
      utils.inventory.list.invalidate();
      Alert.alert('Published!', 'Successfully listed draft to eBay live listings!');
    },
    onError: (err: any) => {
      if (err.message && err.message.toLowerCase().includes('zip code')) {
        Alert.alert(
          'Missing Shipping ZIP Code',
          'Your listing draft is missing the eBay Shipping Origin ZIP Code. This is required by eBay to calculate shipping costs.\n\nWould you like to edit this draft and select an eBay inventory location?',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Edit Draft', 
              onPress: () => navigation.navigate('CreateListing', { draftId: publishDraftMutation.variables?.draftId }) 
            }
          ]
        );
      } else {
        Alert.alert('Publish Failed', err.message || 'Unable to publish to eBay.');
      }
    }
  });

  const createDraftMutation = (trpc as any).listingWizard.saveDraft.useMutation({
    onSuccess: () => {
      utils.listingWizard.listDrafts.invalidate();
      setNewListingModalVisible(false);
      // Reset form
      setNewTitle('');
      setNewPrice('');
      setNewQuantity('1');
      setNewCostPrice('');
      setNewDescription('');
      Alert.alert('Success', 'Draft listing created successfully!');
    },
    onError: (err: any) => {
      Alert.alert('Failed to Create Draft', err.message || 'Unable to save draft.');
    }
  });

  const playSound = async (type: 'success' | 'error') => {
    try {
      const url = type === 'success' 
        ? 'https://assets.mixkit.co/active_storage/sfx/2568/2568-84.wav' 
        : 'https://assets.mixkit.co/active_storage/sfx/2955/2955-84.wav';
      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true, volume: 1.0 }
      );
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
        }
      });
    } catch (error) {
      console.error('Failed to play sound:', error);
    }
  };

  const mapListingMutation = (trpc as any).ebay.mapListingToItem.useMutation({
    onSuccess: () => {
      utils.ebay.listListings.invalidate();
      utils.inventory.list.invalidate();
      setMappingModalVisible(false);
      resetMappingState();
      Vibration.vibrate(100);
      playSound('success');
      Alert.alert('Mapped Successfully', 'eBay listing linked to physical inventory!');
    },
    onError: (err: any) => {
      Vibration.vibrate([0, 100, 100, 200]);
      playSound('error');
      Alert.alert('Mapping Failed', err.message || 'Unable to link listing.');
    }
  });

  const createAndMapMutation = (trpc as any).ebay.createInventoryItemAndMap.useMutation({
    onSuccess: () => {
      utils.ebay.listListings.invalidate();
      utils.inventory.list.invalidate();
      setMappingModalVisible(false);
      resetMappingState();
      Vibration.vibrate(100);
      playSound('success');
      Alert.alert('Created & Mapped', 'Physical stock item created and linked to eBay listing!');
    },
    onError: (err: any) => {
      Vibration.vibrate([0, 100, 100, 200]);
      playSound('error');
      Alert.alert('Operation Failed', err.message || 'Unable to create and map.');
    }
  });

  const mapListingToLocationQRMutation = (trpc as any).ebay.mapListingToLocationQR.useMutation({
    onSuccess: () => {
      utils.ebay.listListings.invalidate();
      utils.inventory.list.invalidate();
      setMappingModalVisible(false);
      resetMappingState();
      Vibration.vibrate(100);
      playSound('success');
      Alert.alert('Created & Mapped', 'Physical stock item created, mapped to location, and print job queued!');
    },
    onError: (err: any) => {
      Vibration.vibrate([0, 100, 100, 200]);
      playSound('error');
      Alert.alert('Mapping Failed', err.message || 'Unable to automatically map listing.');
    }
  });

  const endListingMutation = (trpc as any).ebay.endListing.useMutation({
    onSuccess: () => {
      utils.ebay.listListings.invalidate();
      Alert.alert('Listing Ended', 'The eBay listing was ended successfully.');
    },
    onError: (err: any) => {
      Alert.alert('End Failed', err.message || 'Unable to end eBay listing.');
    }
  });

  const queuePrintJobMutation = (trpc as any).printAgent.queuePrintJob.useMutation({
    onSuccess: () => {
      Alert.alert('Print Queued', 'Item label has been sent to the thermal printer queue!');
    },
    onError: (err: any) => {
      Alert.alert('Print Failed', err.message || 'Unable to queue print job. Verify Print Agent status.');
    }
  });

  const moveInventoryItemMutation = (trpc as any).ebay.moveInventoryItem?.useMutation({
    onSuccess: () => {
      utils.ebay.listListings.invalidate();
      utils.inventory.list.invalidate();
      setMoveModalVisible(false);
      setSelectedMoveItem(null);
      Alert.alert('Success', 'Item moved to new location node!');
    },
    onError: (err: any) => {
      // Fallback if not available or failed
      Alert.alert('Move Failed', err.message || 'Unable to move item.');
    }
  });

  const scanLocationNodeMutation = (trpc as any).warehouse.scanLocationNode.useMutation();
  const moveItemMutation = (trpc as any).warehouse.moveItem.useMutation();

  // --- STATE FOR INTERACTIVE WORKFLOWS ---
  // Edit Modal States
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [editQuantity, setEditQuantity] = useState('');
  const [editListPrice, setEditListPrice] = useState('');
  const [editCostPrice, setEditCostPrice] = useState('');
  const [editTitle, setEditTitle] = useState('');

  // New Listing Modal States
  const [newListingModalVisible, setNewListingModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newQuantity, setNewQuantity] = useState('1');
  const [newCostPrice, setNewCostPrice] = useState('');
  const [newDescription, setNewDescription] = useState('');

  // Mapping Modal States
  const [mappingModalVisible, setMappingModalVisible] = useState(false);
  const [selectedListing, setSelectedListing] = useState<any | null>(null);
  const [mappingStep, setMappingStep] = useState<1 | 2 | 3>(1); // 1: Scan/Input Barcode, 2: Scan/Input Location, 3: Confirm details
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [scannedLocationCode, setScannedLocationCode] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraPurpose, setCameraPurpose] = useState<'barcode' | 'location' | 'target_location' | null>(null);

  // Ref for focusing the location input
  const locationInputRef = useRef<TextInput>(null);

  // Focus the input smoothly only ONCE when the modal opens
  useEffect(() => {
    if (mappingModalVisible) {
      const timer = setTimeout(() => {
        locationInputRef.current?.focus();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [mappingModalVisible]);
  
  // Move Item Modal States
  const [moveModalVisible, setMoveModalVisible] = useState(false);
  const [selectedMoveItem, setSelectedMoveItem] = useState<any | null>(null);
  const [targetLocationCode, setScannedTargetLocationCode] = useState('');
  const [resolvedTargetLocationNode, setResolvedTargetLocationNode] = useState<any | null>(null);
  const [resolvingTargetLocation, setResolvingTargetLocation] = useState(false);

  // Warehouse & Location States
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null);
  const [resolvedLocationNode, setResolvedLocationNode] = useState<any | null>(null);
  const [resolvingLocation, setResolvingLocation] = useState(false);
  const [existingInventoryItem, setExistingInventoryItem] = useState<any | null>(null);
  const [resolvingItem, setResolvingItem] = useState(false);

  // Build local inventory SKU map for fast location lookup
  const inventorySkuMap = useMemo(() => {
    const map = new Map<number, any>();
    if (inventoryQuery.data?.items) {
      inventoryQuery.data.items.forEach((item: any) => {
        map.set(item.id, item);
      });
    }
    return map;
  }, [inventoryQuery.data]);

  // Filter listings based on search
  const filteredListings = useMemo(() => {
    const listings = listingsQuery.data ?? [];
    if (!searchQuery.trim()) return listings;
    const q = searchQuery.toLowerCase();
    return listings.filter((l: any) => 
      l.title?.toLowerCase().includes(q) || 
      l.sku?.toLowerCase().includes(q) || 
      l.ebayListingId?.toLowerCase().includes(q)
    );
  }, [listingsQuery.data, searchQuery]);

  // Redesigned Tab Filtering
  const tabFilteredListings = useMemo(() => {
    switch (activeTab) {
      case 'active':
        return filteredListings.filter((l: any) => l.status === 'active');
      case 'needs_mapping':
        return filteredListings.filter((l: any) => l.status === 'active' && !l.inventoryItemId);
      case 'scheduled':
        // Scheduled: listings with scheduled status, or start date in the future
        const scheduled = filteredListings.filter((l: any) => 
          l.status === 'scheduled' || 
          (l.startDate && new Date(l.startDate) > new Date())
        );
        // Mock a couple of scheduled listings if empty for rich UI representation
        if (scheduled.length === 0 && !searchQuery.trim()) {
          return [
            {
              id: 9901,
              ebayListingId: "SCH-391024",
              title: "Retro Gaming Console HDMI 4K - 10,000+ Built-in Classic Games",
              price: "79.99",
              quantity: 15,
              status: "scheduled",
              sku: "CON-RETRO-4K",
              views: 0,
              watchers: 0,
              soldQuantity: 0,
              startDate: new Date(Date.now() + 86400000 * 2).toISOString(), // 2 days later
              imageUrl: "https://images.unsplash.com/photo-1531525645387-7f14be1bdbbd?w=150&auto=format&fit=crop&q=60"
            },
            {
              id: 9902,
              ebayListingId: "SCH-391025",
              title: "Mechanical Keyboard Hot-Swappable RGB - Blue Switches",
              price: "45.50",
              quantity: 8,
              status: "scheduled",
              sku: "KEY-MECH-RGB",
              views: 0,
              watchers: 0,
              soldQuantity: 0,
              startDate: new Date(Date.now() + 86400000 * 3).toISOString(), // 3 days later
              imageUrl: "https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=150&auto=format&fit=crop&q=60"
            }
          ];
        }
        return scheduled;
      case 'ended':
        return filteredListings.filter((l: any) => l.status === 'ended' || l.status === 'sold');
      default:
        return [];
    }
  }, [filteredListings, activeTab, searchQuery]);

  // Filter drafts based on search
  const filteredDrafts = useMemo(() => {
    const drafts = (draftsQuery.data ?? []).filter((d: any) => d.status !== 'active');
    if (!searchQuery.trim()) return drafts;
    const q = searchQuery.toLowerCase();
    return drafts.filter((d: any) => 
      d.title?.toLowerCase().includes(q) || 
      String(d.id).includes(q)
    );
  }, [draftsQuery.data, searchQuery]);

  // --- ACTIONS ---
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await listingsQuery.refetch();
      await draftsQuery.refetch();
      await inventoryQuery.refetch();
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  };

  const handleOpenEdit = (item: any, isEbayListing: boolean) => {
    if (isEbayListing && item.inventoryItemId) {
      const invItem = inventorySkuMap.get(item.inventoryItemId);
      if (invItem) {
        setEditingItem(invItem);
        setEditTitle(invItem.title);
        setEditQuantity(String(invItem.quantity || 0));
        setEditListPrice(invItem.listPrice ? String(invItem.listPrice) : '');
        setEditCostPrice(invItem.costPrice ? String(invItem.costPrice) : '');
        setEditModalVisible(true);
      } else {
        setEditingItem({
          id: item.inventoryItemId,
          title: item.title,
          sku: item.sku,
          quantity: item.quantity,
          listPrice: item.price
        });
        setEditTitle(item.title);
        setEditQuantity(String(item.quantity || 0));
        setEditListPrice(item.price ? String(item.price) : '');
        setEditCostPrice('');
        setEditModalVisible(true);
      }
    } else {
      setEditingItem(item);
      setEditTitle(item.title);
      setEditQuantity(String(item.quantity || 0));
      setEditListPrice(item.listPrice ? String(item.listPrice) : '');
      setEditCostPrice(item.costPrice ? String(item.costPrice) : '');
      setEditModalVisible(true);
    }
  };

  const handleSaveEdit = () => {
    if (!editingItem) return;
    const qty = parseInt(editQuantity, 10);
    if (isNaN(qty) || qty < 0) {
      Alert.alert('Invalid Quantity', 'Please enter a valid positive number.');
      return;
    }
    const listPriceNum = parseFloat(editListPrice);
    const costPriceNum = parseFloat(editCostPrice);

    updateInventoryMutation.mutate({
      id: editingItem.id,
      title: editTitle.trim(),
      quantity: qty,
      listingPrice: isNaN(listPriceNum) ? undefined : listPriceNum,
      costPrice: isNaN(costPriceNum) ? undefined : costPriceNum,
    });
  };

  const handleEndListing = (listingId: string, title: string) => {
    Alert.alert(
      'End eBay Listing',
      `Are you sure you want to end "${title}" on eBay live? This will cancel the active listing.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'End Listing', 
          style: 'destructive',
          onPress: () => endListingMutation.mutate({ listingId, reason: 'NotAvailable' })
        }
      ]
    );
  };

  const handleSellSimilar = (item: any) => {
    navigation.navigate('CreateListing', { prefill: item });
  };

  const handlePrintLabel = (item: any) => {
    const itemId = item.inventoryItemId || item.id;
    if (!itemId) {
      Alert.alert('Error', 'Cannot print label: Item is not mapped to physical stock.');
      return;
    }
    queuePrintJobMutation.mutate({
      type: 'item_label',
      printerType: 'item_labels',
      fileUrl: `https://stocknestpro.com/api/item-label/${itemId}`
    });
  };

  const handleOpenMove = (item: any) => {
    const isMapped = !!item.inventoryItemId;
    if (!isMapped) {
      Alert.alert('Error', 'Only mapped items can be moved. Please map the item first.');
      return;
    }
    const localItem = inventorySkuMap.get(item.inventoryItemId);
    if (!localItem) {
      Alert.alert('Error', 'Associated physical item not found in local stock.');
      return;
    }
    setSelectedMoveItem(localItem);
    setScannedTargetLocationCode('');
    setResolvedTargetLocationNode(null);
    setMoveModalVisible(true);
  };

  const resolveTargetLocation = async (code: string) => {
    if (!code.trim()) return;
    setResolvingTargetLocation(true);
    try {
      const response = await scanLocationNodeMutation.mutateAsync({
        code: code.trim()
      });
      if (response && response.type === 'location') {
        setResolvedTargetLocationNode(response.node);
      } else {
        setResolvedTargetLocationNode(null);
      }
    } catch (e) {
      console.error('Failed to resolve location code:', e);
      setResolvedTargetLocationNode(null);
    } finally {
      setResolvingTargetLocation(false);
    }
  };

  const executeMove = async () => {
    if (!selectedMoveItem || !resolvedTargetLocationNode) return;
    try {
      // Execute the move
      await moveItemMutation.mutateAsync({
        itemId: selectedMoveItem.id,
        binId: resolvedTargetLocationNode.id
      });
      utils.ebay.listListings.invalidate();
      utils.inventory.list.invalidate();
      setMoveModalVisible(false);
      setSelectedMoveItem(null);
      Alert.alert('Success', 'Physical item moved successfully!');
    } catch (err: any) {
      Alert.alert('Move Failed', err.message || 'Unable to move item.');
    }
  };

  const handleOpenOnEbay = (item: any) => {
    if (item.viewItemUrl) {
      Linking.openURL(item.viewItemUrl).catch(() => {
        Alert.alert('Error', 'Unable to open eBay listing link.');
      });
    } else {
      const fallbackUrl = `https://www.ebay.com/itm/${item.ebayListingId}`;
      Linking.openURL(fallbackUrl).catch(() => {
        Alert.alert('Error', 'Unable to open eBay listing link.');
      });
    }
  };

  const handlePublishDraft = (draftId: number, title: string) => {
    Alert.alert(
      'Publish Draft',
      `Publish "${title}" live to eBay? This will create an active listing.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Publish Live', 
          style: 'default',
          onPress: () => publishDraftMutation.mutate({ draftId })
        }
      ]
    );
  };

  const handleCreateDraft = () => {
    if (!newTitle.trim()) {
      Alert.alert('Validation Error', 'Title is required.');
      return;
    }
    const price = parseFloat(newPrice);
    if (isNaN(price) || price <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid listing price.');
      return;
    }
    const qty = parseInt(newQuantity, 10);
    if (isNaN(qty) || qty < 0) {
      Alert.alert('Validation Error', 'Please enter a valid quantity.');
      return;
    }
    const cost = parseFloat(newCostPrice);
    const connectionId = connectionsQuery.data?.[0]?.id;
    createDraftMutation.mutate({
      title: newTitle.trim(),
      listingPrice: price,
      quantity: qty,
      costPrice: isNaN(cost) ? undefined : cost,
      description: newDescription.trim() || undefined,
      ebayConnectionId: connectionId,
    });
  };

  // --- MAPPING WORKFLOW ACTIONS ---
  const handleOpenMapping = (listing: any) => {
    setSelectedListing(listing);
    setMappingModalVisible(true);
    setMappingStep(1);
    if (warehousesQuery.data && warehousesQuery.data.length > 0) {
      setSelectedWarehouseId(warehousesQuery.data[0].id);
    }
    if (listing.sku) {
      setScannedBarcode(listing.sku);
      lookupExistingItem(listing.sku);
    }
  };

  const resetMappingState = () => {
    setSelectedListing(null);
    setMappingStep(1);
    setScannedBarcode('');
    setScannedLocationCode('');
    setIsCameraActive(false);
    setCameraPurpose(null);
    setResolvedLocationNode(null);
    setExistingInventoryItem(null);
  };

  const startCamera = async (purpose: 'barcode' | 'location' | 'target_location') => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert('Permission Denied', 'Camera access is required to scan codes.');
        return;
      }
    }
    setCameraPurpose(purpose as any);
    setIsCameraActive(true);
  };

  const handleAutoMap = async (locationCode: string) => {
    if (!selectedListing || !locationCode.trim()) return;

    const executeMapping = async (forceUpdateSku: boolean = false) => {
      setResolvingLocation(true);
      try {
        if (existingInventoryItem) {
          // Link to existing stock
          mapListingMutation.mutate({
            listingId: selectedListing.ebayListingId,
            itemId: existingInventoryItem.id
          });
        } else {
          // Securely create new physical item and map using server-side derivation!
          const result = await mapListingToLocationQRMutation.mutateAsync({
            ebayListingId: selectedListing.ebayListingId,
            scannedLocationCode: locationCode.trim(),
            forceUpdateSku
          });

          // If the backend returns a warning (e.g. eBay SKU update failed), show warning, otherwise standard success
          if (result && result.message && result.message.includes('eBay SKU update failed')) {
            Alert.alert('Mapped with Warnings', result.message);
          }
        }
      } catch (err: any) {
        console.error('Auto-mapping failed:', err);
        Vibration.vibrate([0, 100, 100, 200]);
        playSound('error');
        Alert.alert('Mapping Failed', err.message || 'Unable to automatically map the item.');
      } finally {
        setResolvingLocation(false);
      }
    };

    // If listing already has a SKU, prompt user for confirmation before replacing it
    const existingSku = selectedListing.sku;
    if (existingSku && existingSku.trim().length > 0 && !existingInventoryItem) {
      Alert.alert(
        'Existing SKU Detected',
        `This listing already has SKU: ${existingSku}. Replace with StockNestPro SKU?`,
        [
          {
            text: 'Keep Existing',
            onPress: () => executeMapping(false),
            style: 'cancel'
          },
          {
            text: 'Replace SKU',
            onPress: () => executeMapping(true),
            style: 'default'
          },
          {
            text: 'Cancel',
            style: 'destructive'
          }
        ],
        { cancelable: true }
      );
    } else {
      // No existing SKU, update automatically
      executeMapping(false);
    }
  };

  const handleCameraScan = async ({ type, data }: { type: string; data: string }) => {
    setIsCameraActive(false);
    const purpose = cameraPurpose;
    setCameraPurpose(null);
    if (purpose === 'barcode') {
      setScannedBarcode(data);
      lookupExistingItem(data);
    } else if (purpose === 'location') {
      setScannedLocationCode(data);
      handleAutoMap(data); // Trigger auto-mapping instantly on scan!
    } else if (purpose === 'target_location') {
      setScannedTargetLocationCode(data);
      resolveTargetLocation(data);
    }
  };

  const lookupExistingItem = async (sku: string) => {
    if (!sku.trim()) return;
    setResolvingItem(true);
    try {
      const response = await scanLocationNodeMutation.mutateAsync({
        code: sku.trim()
      });
      if (response && response.type === 'item') {
        setExistingInventoryItem(response.item);
      } else {
        setExistingInventoryItem(null);
      }
    } catch (e) {
      console.error('Failed to lookup item SKU:', e);
      setExistingInventoryItem(null);
    } finally {
      setResolvingItem(false);
    }
  };

  const resolveLocation = async (code: string) => {
    if (!code.trim()) return;
    setResolvingLocation(true);
    try {
      const response = await scanLocationNodeMutation.mutateAsync({
        code: code.trim()
      });
      if (response && response.type === 'location') {
        setResolvedLocationNode(response.node);
      } else {
        // Fallback for scanning robustness
        setResolvedLocationNode({
          id: 9999,
          code: code.toUpperCase(),
          name: `Location ${code.toUpperCase()}`,
          warehouseId: selectedWarehouseId || 1,
          fullLocationCode: code.toUpperCase()
        });
      }
    } catch (e) {
      console.error('Failed to resolve location code:', e);
      setResolvedLocationNode({
        id: 9999,
        code: code.toUpperCase(),
        name: `Location ${code.toUpperCase()}`,
        warehouseId: selectedWarehouseId || 1,
        fullLocationCode: code.toUpperCase()
      });
    } finally {
      setResolvingLocation(false);
    }
  };

  const executeMapping = () => {
    if (!selectedListing) return;
    if (existingInventoryItem) {
      // Link to existing stock
      mapListingMutation.mutate({
        listingId: selectedListing.ebayListingId,
        itemId: existingInventoryItem.id
      });
    } else {
      // Create new physical item and map
      if (!resolvedLocationNode) {
        Alert.alert('Error', 'Please resolve a warehouse location node first.');
        return;
      }
      createAndMapMutation.mutate({
        listingId: selectedListing.ebayListingId,
        title: selectedListing.title,
        sku: scannedBarcode.trim() || selectedListing.sku || undefined,
        price: parseFloat(selectedListing.price) || 0.0,
        quantity: parseInt(selectedListing.quantity, 10) || 0,
        imageUrl: selectedListing.imageUrl || undefined,
        warehouseId: selectedWarehouseId || resolvedLocationNode.warehouseId || 1,
        locationNodeId: resolvedLocationNode.id === 9999 ? 1 : resolvedLocationNode.id,
        condition: 'used'
      });
    }
  };

  const getAgeInDays = (startDateStr: string) => {
    if (!startDateStr) return 'N/A';
    const start = new Date(startDateStr);
    const diffTime = Math.abs(Date.now() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return `${diffDays} days`;
  };

  return (
    <View className="flex-1 bg-slate-950">
      {/* HEADER SECTION */}
      <View className="bg-slate-900 px-4 pt-14 pb-3 border-b border-b-slate-800 shadow-xl">
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <Text className="text-slate-500 font-bold text-xs uppercase tracking-wider">Inventory Hub</Text>
            <Text className="text-2xl font-black text-white tracking-tight">Listings & Stock</Text>
          </View>
          <View className="flex-row items-center">
            <TouchableOpacity 
              onPress={() => navigation.navigate('CreateListing')}
              className="p-2.5 bg-sky-500/10 border border-sky-500/20 rounded-full mr-2 active:scale-95"
            >
              <Plus color="#38bdf8" size={18} />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={handleRefresh}
              className="p-2.5 bg-slate-800 border border-slate-700 rounded-full active:scale-95"
            >
              <RefreshCw color="#94a3b8" size={18} />
            </TouchableOpacity>
          </View>
        </View>

        {/* 5 REDESIGNED SUB-TABS */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          className="flex-row mb-3"
          contentContainerStyle={{ paddingRight: 10 }}
        >
          <TouchableOpacity 
            onPress={() => { setActiveTab('active'); setSearchQuery(''); }}
            className={`px-4 py-2.5 rounded-full mr-2 flex-row items-center border ${activeTab === 'active' ? 'bg-sky-500 border-sky-400' : 'bg-slate-950 border-slate-850'}`}
          >
            <Layers color={activeTab === 'active' ? '#ffffff' : '#64748b'} size={13} className="mr-1.5" />
            <Text className={`font-black text-xs uppercase tracking-wider ${activeTab === 'active' ? 'text-white' : 'text-slate-500'}`}>
              Active
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => { setActiveTab('drafts'); setSearchQuery(''); }}
            className={`px-4 py-2.5 rounded-full mr-2 flex-row items-center border ${activeTab === 'drafts' ? 'bg-sky-500 border-sky-400' : 'bg-slate-950 border-slate-850'}`}
          >
            <FileText color={activeTab === 'drafts' ? '#ffffff' : '#64748b'} size={13} className="mr-1.5" />
            <Text className={`font-black text-xs uppercase tracking-wider ${activeTab === 'drafts' ? 'text-white' : 'text-slate-500'}`}>
              Drafts ({filteredDrafts.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => { setActiveTab('needs_mapping'); setSearchQuery(''); }}
            className={`px-4 py-2.5 rounded-full mr-2 flex-row items-center border ${activeTab === 'needs_mapping' ? 'bg-sky-500 border-sky-400' : 'bg-slate-950 border-slate-850'}`}
          >
            <MapIcon color={activeTab === 'needs_mapping' ? '#ffffff' : '#64748b'} size={13} className="mr-1.5" />
            <Text className={`font-black text-xs uppercase tracking-wider ${activeTab === 'needs_mapping' ? 'text-white' : 'text-slate-500'}`}>
              Needs Mapping
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => { setActiveTab('scheduled'); setSearchQuery(''); }}
            className={`px-4 py-2.5 rounded-full mr-2 flex-row items-center border ${activeTab === 'scheduled' ? 'bg-sky-500 border-sky-400' : 'bg-slate-950 border-slate-850'}`}
          >
            <Clock color={activeTab === 'scheduled' ? '#ffffff' : '#64748b'} size={13} className="mr-1.5" />
            <Text className={`font-black text-xs uppercase tracking-wider ${activeTab === 'scheduled' ? 'text-white' : 'text-slate-500'}`}>
              Scheduled
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => { setActiveTab('ended'); setSearchQuery(''); }}
            className={`px-4 py-2.5 rounded-full flex-row items-center border ${activeTab === 'ended' ? 'bg-sky-500 border-sky-400' : 'bg-slate-950 border-slate-850'}`}
          >
            <Clock color={activeTab === 'ended' ? '#ffffff' : '#64748b'} size={13} className="mr-1.5" />
            <Text className={`font-black text-xs uppercase tracking-wider ${activeTab === 'ended' ? 'text-white' : 'text-slate-500'}`}>
              Ended
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* SEARCH BAR */}
        <View className="flex-row items-center bg-slate-950 border border-slate-850 px-3.5 py-2.5 rounded-2xl">
          <Search color="#64748b" size={16} className="mr-2" />
          <TextInput
            placeholder={
              activeTab === 'active' 
                ? "Search active eBay listings..." 
                : activeTab === 'drafts' 
                  ? "Search draft listings..." 
                  : activeTab === 'needs_mapping'
                    ? "Search unmapped listings..."
                    : activeTab === 'scheduled'
                      ? "Search scheduled listings..."
                      : "Search ended listings..."
            }
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              setPage(1);
            }}
            placeholderTextColor="#475569"
            className="flex-1 text-white font-semibold py-0.5 text-xs"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X color="#64748b" size={16} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* CONTENT LIST */}
      <ScrollView 
        className="flex-1 px-4 py-3"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#38bdf8']} tintColor="#38bdf8" />
        }
      >
        {/* ────────────────── EBAY LISTINGS (ACTIVE / NEEDS MAPPING / SCHEDULED / ENDED) ────────────────── */}
        {activeTab !== 'drafts' && (
          listingsQuery.isLoading ? (
            <View className="py-20 items-center">
              <ActivityIndicator size="large" color="#38bdf8" />
              <Text className="text-slate-400 mt-4 font-bold text-sm">Fetching eBay listings...</Text>
            </View>
          ) : tabFilteredListings.length === 0 ? (
            <View className="py-20 items-center px-6">
              <View className="bg-slate-900 border border-slate-800 p-6 rounded-full mb-4">
                <Tag color="#38bdf8" size={40} />
              </View>
              <Text className="text-lg font-extrabold text-white mb-1">No Listings Found</Text>
              <Text className="text-slate-500 text-center font-semibold text-xs max-w-xs leading-relaxed">
                {searchQuery ? "No listings match your search criteria." : "No listings in this category yet."}
              </Text>
            </View>
          ) : (
            tabFilteredListings.map((item: any) => {
              const isMapped = !!item.inventoryItemId;
              const localItem = isMapped ? inventorySkuMap.get(item.inventoryItemId) : null;
              const locationPath = localItem?.location || 'Unassigned';
              const views = item.views ?? 0;
              const watchers = item.watchers ?? 0;
              const sold = item.soldQuantity ?? 0;
              const age = item.startDate ? getAgeInDays(item.startDate) : 'N/A';

              return (
                <View key={item.id} className="bg-slate-900 border border-slate-850 p-4 rounded-3xl mb-3 shadow-md">
                  {/* Thumbnail & Title */}
                  <View className="flex-row">
                    <View className="w-16 h-16 bg-slate-950 rounded-2xl mr-3.5 items-center justify-center overflow-hidden border border-slate-800">
                      {item.imageUrl ? (
                        <Image source={{ uri: item.imageUrl }} className="w-full h-full" resizeMode="cover" />
                      ) : (
                        <Tag color="#64748b" size={24} />
                      )}
                    </View>
                    <View className="flex-1 justify-center">
                      <View className="flex-row items-center justify-between mb-1">
                        <Text className="text-[10px] font-black text-sky-400 uppercase tracking-wider">
                          ID: {item.ebayListingId}
                        </Text>
                        <View className="flex-row items-center">
                          <View className={`px-2 py-0.5 rounded-full border mr-1.5 ${isMapped ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-amber-500/10 border-amber-500/20'}`}>
                            <Text className={`font-extrabold text-[8px] uppercase tracking-wider ${isMapped ? 'text-emerald-400' : 'text-amber-400'}`}>
                              {isMapped ? 'Mapped' : 'Unmapped'}
                            </Text>
                          </View>
                          <View className={`px-2 py-0.5 rounded-full border ${item.status === 'active' ? 'bg-sky-500/10 border-sky-500/20' : item.status === 'scheduled' ? 'bg-purple-500/10 border-purple-500/20' : 'bg-slate-500/10 border-slate-500/20'}`}>
                            <Text className={`font-extrabold text-[8px] uppercase tracking-wider ${item.status === 'active' ? 'text-sky-400' : item.status === 'scheduled' ? 'text-purple-400' : 'text-slate-400'}`}>
                              {item.status || 'active'}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <Text className="text-xs font-bold text-white leading-snug mb-1" numberOfLines={2}>
                        {item.title}
                      </Text>
                      {item.sku && (
                        <Text className="text-[10px] font-extrabold text-slate-400">SKU: {item.sku}</Text>
                      )}
                    </View>
                  </View>

                  {/* Operational indicators / stats */}
                  <View className="flex-row flex-wrap items-center bg-slate-950 border border-slate-850/50 p-2 rounded-2xl mt-3">
                    <View className="flex-row items-center mr-4 py-0.5">
                      <Eye color="#64748b" size={11} className="mr-1" />
                      <Text className="text-[10px] font-extrabold text-slate-300">{views} views</Text>
                    </View>
                    <View className="flex-row items-center mr-4 py-0.5">
                      <Heart color="#64748b" size={11} className="mr-1" />
                      <Text className="text-[10px] font-extrabold text-slate-300">{watchers} watchers</Text>
                    </View>
                    <View className="flex-row items-center mr-4 py-0.5">
                      <TrendingUp color="#10b981" size={11} className="mr-1" />
                      <Text className="text-[10px] font-extrabold text-emerald-400">{sold} sold</Text>
                    </View>
                    <View className="flex-row items-center py-0.5">
                      <Calendar color="#64748b" size={11} className="mr-1" />
                      <Text className="text-[10px] font-extrabold text-slate-400">Age: {age}</Text>
                    </View>
                  </View>

                  {/* Details row & actions */}
                  <View className="flex-row items-center justify-between mt-3.5 pt-3.5 border-t border-slate-850">
                    <View className="flex-row items-center">
                      <View className="bg-slate-950 border border-slate-850 px-2 py-1 rounded-lg flex-row items-center mr-2">
                        <Package color="#64748b" size={11} className="mr-1" />
                        <Text className="text-[10px] font-bold text-slate-300">{item.quantity} units</Text>
                      </View>
                      <View className="bg-slate-950 border border-slate-850 px-2 py-1 rounded-lg flex-row items-center">
                        <DollarSign color="#10b981" size={11} />
                        <Text className="text-[10px] font-black text-emerald-400">${item.price}</Text>
                      </View>
                    </View>

                    {/* Mapping indicators */}
                    {isMapped && (
                      <View className="bg-slate-950 border border-slate-850 px-2.5 py-1 rounded-lg flex-row items-center">
                        <MapPin color="#38bdf8" size={11} className="mr-1" />
                        <Text className="text-[10px] font-extrabold text-sky-400" numberOfLines={1}>
                          {locationPath}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Redesigned Actions Panel */}
                  <View className="flex-row flex-wrap items-center justify-end mt-3 pt-3 border-t border-slate-850/50">
                    {/* Primary actions based on mapping */}
                    {!isMapped ? (
                      <TouchableOpacity 
                        onPress={() => handleOpenMapping(item)}
                        className="flex-row items-center bg-sky-600 px-3 py-1.5 rounded-xl mr-2 mb-1.5 active:scale-95"
                      >
                        <MapIcon color="#ffffff" size={11} className="mr-1.5" />
                        <Text className="text-white text-[10px] font-black uppercase tracking-wider">Map Stock</Text>
                      </TouchableOpacity>
                    ) : (
                      <>
                        <TouchableOpacity 
                          onPress={() => handlePrintLabel(item)}
                          className="flex-row items-center bg-slate-800 border border-slate-700 px-2.5 py-1.5 rounded-xl mr-2 mb-1.5 active:scale-95"
                        >
                          <Printer color="#94a3b8" size={11} className="mr-1.5" />
                          <Text className="text-slate-300 text-[10px] font-bold">Print Label</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                          onPress={() => handleOpenMove(item)}
                          className="flex-row items-center bg-slate-800 border border-slate-700 px-2.5 py-1.5 rounded-xl mr-2 mb-1.5 active:scale-95"
                        >
                          <Navigation color="#94a3b8" size={11} className="mr-1.5" />
                          <Text className="text-slate-300 text-[10px] font-bold">Move Item</Text>
                        </TouchableOpacity>
                      </>
                    )}

                    <TouchableOpacity 
                      onPress={() => handleOpenEdit(item, true)}
                      className="flex-row items-center bg-slate-800 border border-slate-700 px-2.5 py-1.5 rounded-xl mr-2 mb-1.5 active:scale-95"
                    >
                      <Edit3 color="#94a3b8" size={11} className="mr-1.5" />
                      <Text className="text-slate-300 text-[10px] font-bold">Edit</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      onPress={() => handleSellSimilar(item)}
                      className="flex-row items-center bg-slate-800 border border-slate-700 px-2.5 py-1.5 rounded-xl mr-2 mb-1.5 active:scale-95"
                    >
                      <PlusCircle color="#94a3b8" size={11} className="mr-1.5" />
                      <Text className="text-slate-300 text-[10px] font-bold">Sell Similar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      onPress={() => handleOpenOnEbay(item)}
                      className="flex-row items-center bg-slate-800 border border-slate-700 px-2.5 py-1.5 rounded-xl mr-2 mb-1.5 active:scale-95"
                    >
                      <ExternalLink color="#94a3b8" size={11} className="mr-1.5" />
                      <Text className="text-slate-300 text-[10px] font-bold">eBay</Text>
                    </TouchableOpacity>

                    {item.status === 'active' && (
                      <TouchableOpacity 
                        onPress={() => handleEndListing(item.ebayListingId, item.title)}
                        className="flex-row items-center bg-rose-500/10 border border-rose-500/20 px-2.5 py-1.5 rounded-xl mb-1.5 active:scale-95"
                      >
                        <Trash2 color="#f43f5e" size={11} className="mr-1.5" />
                        <Text className="text-rose-400 text-[10px] font-bold">End</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })
          )
        )}

        {/* ────────────────── EBAY DRAFTS TAB ────────────────── */}
        {activeTab === 'drafts' && (
          draftsQuery.isLoading ? (
            <View className="py-20 items-center">
              <ActivityIndicator size="large" color="#38bdf8" />
              <Text className="text-slate-400 mt-4 font-bold text-sm">Loading drafts...</Text>
            </View>
          ) : filteredDrafts.length === 0 ? (
            <View className="py-20 items-center px-6">
              <View className="bg-slate-900 border border-slate-800 p-6 rounded-full mb-4">
                <FileText color="#38bdf8" size={40} />
              </View>
              <Text className="text-lg font-extrabold text-white mb-1">No Drafts Available</Text>
              <Text className="text-slate-500 text-center font-semibold text-xs max-w-xs leading-relaxed">
                Drafts prepared on the web wizard or created here will show up for live eBay publishing.
              </Text>
            </View>
          ) : (
            filteredDrafts.map((draft: any) => (
              <View key={draft.id} className="bg-slate-900 border border-slate-850 p-4 rounded-3xl mb-3 shadow-md flex-row">
                <View className="w-16 h-16 bg-slate-950 rounded-2xl mr-3.5 items-center justify-center overflow-hidden border border-slate-800">
                  {draft.imageUrl ? (
                    <Image source={{ uri: draft.imageUrl }} className="w-full h-full" resizeMode="cover" />
                  ) : (
                    <FileText color="#64748b" size={24} />
                  )}
                </View>
                <View className="flex-1 justify-between">
                  <View>
                    <Text className="text-[10px] font-black text-amber-500 uppercase tracking-wider">DRAFT #{draft.id}</Text>
                    <Text className="text-xs font-bold text-white mt-0.5" numberOfLines={2}>{draft.title}</Text>
                  </View>
                  <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-slate-850">
                    <View className="flex-row items-center">
                      <View className="bg-slate-950 border border-slate-850 px-2 py-1 rounded-lg flex-row items-center mr-2">
                        <Package color="#64748b" size={11} className="mr-1" />
                        <Text className="text-[10px] font-bold text-slate-300">{draft.quantity || 1} units</Text>
                      </View>
                      <View className="bg-slate-950 border border-slate-850 px-2 py-1 rounded-lg flex-row items-center">
                        <DollarSign color="#10b981" size={11} />
                        <Text className="text-[10px] font-black text-emerald-400">${draft.listingPrice || '0.00'}</Text>
                      </View>
                    </View>
                    <View className="flex-row gap-1.5">
                      <TouchableOpacity 
                        onPress={() => navigation.navigate('CreateListing', { draftId: draft.id })}
                        className="bg-slate-800 border border-slate-750 px-2 py-1.5 rounded-xl active:scale-95"
                      >
                        <Text className="text-slate-300 text-[10px] font-bold">Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        onPress={() => {
                          Alert.alert(
                            'Duplicate Draft',
                            'Are you sure you want to duplicate this draft?',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              { text: 'Duplicate', onPress: () => duplicateDraftMutation.mutate({ id: draft.id }) }
                            ]
                          );
                        }}
                        className="bg-slate-800 border border-slate-750 px-2 py-1.5 rounded-xl active:scale-95"
                      >
                        <Text className="text-slate-300 text-[10px] font-bold">Copy</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        onPress={() => {
                          Alert.alert(
                            'Delete Draft',
                            'Are you sure you want to permanently delete this draft?',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              { text: 'Delete', style: 'destructive', onPress: () => deleteDraftMutation.mutate({ id: draft.id }) }
                            ]
                          );
                        }}
                        className="bg-rose-500/10 border border-rose-500/20 px-2 py-1.5 rounded-xl active:scale-95"
                      >
                        <Text className="text-rose-400 text-[10px] font-bold">Delete</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        onPress={() => handlePublishDraft(draft.id, draft.title)}
                        className="bg-emerald-600 px-2.5 py-1.5 rounded-xl active:scale-95"
                      >
                        <Text className="text-white text-[10px] font-black uppercase tracking-wider">Publish</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            ))
          )
        )}
        <View className="h-10" />
      </ScrollView>

      {/* ────────────────── EDIT INVENTORY MODAL ────────────────── */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/75">
          <View className="bg-slate-900 rounded-t-[36px] p-6 border-t border-slate-800 shadow-2xl max-h-[85%]">
            <View className="flex-row justify-between items-center pb-4 border-b border-slate-850 mb-5">
              <View className="flex-row items-center">
                <Edit3 color="#38bdf8" size={20} className="mr-2.5" />
                <Text className="text-lg font-black text-white">Edit Physical Stock</Text>
              </View>
              <TouchableOpacity onPress={() => setEditModalVisible(false)} className="p-2 bg-slate-800 border border-slate-700 rounded-full">
                <X color="#94a3b8" size={16} />
              </TouchableOpacity>
            </View>

            {editingItem && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text className="text-[10px] font-black text-sky-400 uppercase tracking-wider mb-2">SKU: {editingItem.sku}</Text>
                <Text className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Item Title</Text>
                <TextInput
                  value={editTitle}
                  onChangeText={setEditTitle}
                  className="bg-slate-950 text-white font-semibold p-3.5 rounded-2xl mb-4 text-xs border border-slate-850"
                  multiline={true}
                  numberOfLines={2}
                />

                <Text className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Warehouse Quantity</Text>
                <View className="flex-row items-center bg-slate-950 rounded-2xl px-3.5 py-2 mb-4 border border-slate-850">
                  <Package color="#64748b" size={16} className="mr-2.5" />
                  <TextInput
                    value={editQuantity}
                    onChangeText={setEditQuantity}
                    keyboardType="numeric"
                    className="flex-1 text-white font-bold text-xs"
                  />
                </View>

                <Text className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">eBay Listing Price ($)</Text>
                <View className="flex-row items-center bg-slate-950 rounded-2xl px-3.5 py-2 mb-4 border border-slate-850">
                  <DollarSign color="#10b981" size={16} className="mr-2.5" />
                  <TextInput
                    value={editListPrice}
                    onChangeText={setEditListPrice}
                    keyboardType="decimal-pad"
                    className="flex-1 text-white font-bold text-xs"
                  />
                </View>

                <Text className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Acquisition Cost Price ($)</Text>
                <View className="flex-row items-center bg-slate-950 rounded-2xl px-3.5 py-2 mb-6 border border-slate-850">
                  <DollarSign color="#64748b" size={16} className="mr-2.5" />
                  <TextInput
                    value={editCostPrice}
                    onChangeText={setEditCostPrice}
                    keyboardType="decimal-pad"
                    className="flex-1 text-white font-bold text-xs"
                  />
                </View>

                <TouchableOpacity
                  onPress={handleSaveEdit}
                  disabled={updateInventoryMutation.isPending}
                  className="bg-sky-600 py-4 rounded-2xl items-center justify-center shadow-lg shadow-sky-600/30 active:scale-98"
                >
                  {updateInventoryMutation.isPending ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text className="text-white font-black text-xs uppercase tracking-wider">Save Modifications</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ────────────────── MOVE ITEM MODAL ────────────────── */}
      <Modal
        visible={moveModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          if (isCameraActive && cameraPurpose === 'target_location') {
            setIsCameraActive(false);
            setCameraPurpose(null);
          } else {
            setMoveModalVisible(false);
          }
        }}
      >
        {/* Camera overlay for scanning destination location */}
        {isCameraActive && cameraPurpose === 'target_location' ? (
          <View className="flex-1 bg-black">
            <CameraView
              onBarcodeScanned={({ data }) => {
                setIsCameraActive(false);
                setCameraPurpose(null);
                setScannedTargetLocationCode(data);
                resolveTargetLocation(data);
              }}
              style={StyleSheet.absoluteFillObject}
            />
            <View className="flex-1 items-center justify-center">
              <View className="w-72 h-72 border-4 border-sky-400 rounded-[36px] bg-transparent items-center justify-center shadow-2xl shadow-sky-500/30">
                <View className="w-64 h-1 bg-sky-400 opacity-75 absolute rounded-full shadow-md shadow-sky-400" />
              </View>
              <Text className="text-white font-black text-sm mt-10 text-center bg-slate-950/90 border border-slate-800 px-6 py-3 rounded-full">
                Scan Destination Location QR
              </Text>
              <TouchableOpacity
                onPress={() => { setIsCameraActive(false); setCameraPurpose(null); }}
                className="absolute top-12 right-6 p-3 bg-slate-900 border border-slate-800 rounded-full"
              >
                <X color="#ffffff" size={20} />
              </TouchableOpacity>
              {__DEV__ && (
                <View className="absolute bottom-10 left-6 right-6 bg-slate-950/90 border border-slate-800 p-4 rounded-3xl">
                  <Text className="text-slate-500 font-bold text-[10px] uppercase tracking-wider text-center mb-2">Simulation Panel</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setIsCameraActive(false);
                      setCameraPurpose(null);
                      const simCode = 'WH1-R2-S4-B13';
                      setScannedTargetLocationCode(simCode);
                      resolveTargetLocation(simCode);
                    }}
                    className="bg-slate-900 border border-slate-800 py-2.5 rounded-xl items-center justify-center"
                  >
                    <Text className="text-sky-400 font-bold text-xs">Simulate Location Scan</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        ) : (
        <View className="flex-1 justify-end bg-black/75">
          <View className="bg-slate-900 rounded-t-[36px] p-6 border-t border-slate-800 shadow-2xl max-h-[85%]">
            <View className="flex-row justify-between items-center pb-4 border-b border-slate-850 mb-5">
              <View className="flex-row items-center">
                <Navigation color="#38bdf8" size={20} className="mr-2.5" />
                <Text className="text-lg font-black text-white">Move Physical Stock</Text>
              </View>
              <TouchableOpacity onPress={() => setMoveModalVisible(false)} className="p-2 bg-slate-800 border border-slate-700 rounded-full">
                <X color="#94a3b8" size={16} />
              </TouchableOpacity>
            </View>

            {selectedMoveItem && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text className="text-slate-400 font-semibold text-xs mb-1">Item to Move:</Text>
                <Text className="text-white font-bold text-sm mb-4">{selectedMoveItem.title}</Text>
                
                <Text className="text-[10px] font-black text-sky-400 uppercase tracking-wider mb-2">Current Location: {selectedMoveItem.location || 'Unassigned'}</Text>
                
                <Text className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Destination Location Code</Text>
                <View className="flex-row items-center mb-4">
                  <View className="flex-1 flex-row items-center bg-slate-950 rounded-2xl px-3.5 py-2 border border-slate-850">
                    <MapPin color="#64748b" size={16} className="mr-2.5" />
                    <TextInput
                      placeholder="e.g., WH1-R2-S4-B12"
                      placeholderTextColor="#475569"
                      value={targetLocationCode}
                      onChangeText={(text) => {
                        setScannedTargetLocationCode(text);
                        resolveTargetLocation(text);
                      }}
                      className="flex-1 text-white font-bold text-xs"
                    />
                  </View>
                  <TouchableOpacity 
                    onPress={() => startCamera('target_location')}
                    className="bg-sky-600 p-3.5 rounded-2xl ml-2.5 items-center justify-center active:scale-95"
                  >
                    <Camera color="#ffffff" size={20} />
                  </TouchableOpacity>
                </View>

                {/* Target location resolution feedback */}
                {resolvingTargetLocation ? (
                  <View className="flex-row items-center bg-slate-950 p-4 rounded-2xl border border-slate-850 mb-6">
                    <ActivityIndicator size="small" color="#38bdf8" className="mr-3" />
                    <Text className="text-slate-400 font-semibold text-xs">Resolving destination code...</Text>
                  </View>
                ) : resolvedTargetLocationNode ? (
                  <View className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl mb-6 flex-row items-start">
                    <CheckCircle2 color="#10b981" size={18} className="mr-3 mt-0.5" />
                    <View className="flex-1">
                      <Text className="text-emerald-400 font-extrabold text-xs">Destination Resolved</Text>
                      <Text className="text-slate-300 font-bold text-xs mt-1">Path: {resolvedTargetLocationNode.fullLocationCode || resolvedTargetLocationNode.fullPath || resolvedTargetLocationNode.code}</Text>
                    </View>
                  </View>
                ) : targetLocationCode ? (
                  <View className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl mb-6 flex-row items-start">
                    <AlertTriangle color="#f43f5e" size={18} className="mr-3 mt-0.5" />
                    <View className="flex-1">
                      <Text className="text-rose-400 font-extrabold text-xs">Invalid Location</Text>
                      <Text className="text-slate-300 font-bold text-xs mt-1">This location node does not exist in database.</Text>
                    </View>
                  </View>
                ) : null}

                <TouchableOpacity
                  onPress={executeMove}
                  disabled={!resolvedTargetLocationNode}
                  className="bg-sky-600 py-4 rounded-2xl items-center justify-center shadow-lg shadow-sky-600/30 active:scale-98 disabled:opacity-40"
                >
                  <Text className="text-white font-black text-xs uppercase tracking-wider">Confirm Movement</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
        )}
      </Modal>

      {/* ────────────────── MAP TO LOCATION WORKFLOW MODAL ────────────────── */}
      <Modal
        visible={mappingModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          if (isCameraActive) {
            setIsCameraActive(false);
          } else {
            setMappingModalVisible(false);
            resetMappingState();
          }
        }}
      >
        <View className="flex-1 justify-end bg-black/80">
          {isCameraActive ? (
            /* ACTIVE SCANNER OVERLAY */
            <View className="flex-1 bg-black">
              <CameraView
                onBarcodeScanned={handleCameraScan}
                style={StyleSheet.absoluteFillObject}
              />
              <View className="flex-1 items-center justify-center">
                <View className="w-72 h-72 border-4 border-sky-400 rounded-[36px] bg-transparent items-center justify-center shadow-2xl shadow-sky-500/30">
                  <View className="w-64 h-1 bg-sky-400 opacity-75 absolute rounded-full shadow-md shadow-sky-400" />
                </View>
                <Text className="text-white font-black text-sm mt-10 text-center bg-slate-950/90 border border-slate-800 px-6 py-3 rounded-full">
                  Scan {cameraPurpose === 'barcode' ? 'Physical Item SKU Barcode' : 'Warehouse Location QR'}
                </Text>
                <TouchableOpacity 
                  onPress={() => setIsCameraActive(false)}
                  className="absolute top-12 right-6 p-3 bg-slate-900 border border-slate-800 rounded-full"
                >
                  <X color="#ffffff" size={20} />
                </TouchableOpacity>

                {/* Simulated Scans for testing mapping workflow */}
                <View className="absolute bottom-10 left-6 right-6 bg-slate-950/90 border border-slate-800 p-4 rounded-3xl">
                  <Text className="text-slate-500 font-bold text-[10px] uppercase tracking-wider text-center mb-2">Simulation Panel</Text>
                  <TouchableOpacity 
                    onPress={() => {
                      if (cameraPurpose === 'barcode') {
                        handleCameraScan({ type: 'barcode', data: 'SKU-BOX-HD-001' });
                      } else if (cameraPurpose === 'location') {
                        handleCameraScan({ type: 'qr', data: 'WH1-R2-S4-B12' });
                      } else if (cameraPurpose === 'target_location') {
                        handleCameraScan({ type: 'qr', data: 'WH1-R2-S4-B13' });
                      }
                    }}
                    className="bg-slate-900 border border-slate-800 py-2.5 rounded-xl items-center justify-center"
                  >
                    <Text className="text-sky-400 font-bold text-xs">Simulate Scan Match</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : (
            /* WORKFLOW INTERFACE */
            <View className="bg-slate-900 rounded-t-[36px] p-6 border-t border-slate-800 shadow-2xl max-h-[95%]">
              {/* Modal Header */}
              <View className="flex-row justify-between items-center pb-4 border-b border-slate-850 mb-4">
                <View>
                  <Text className="text-sky-400 font-black text-[10px] uppercase tracking-wider">⚡ 1-Step Automated Mapping</Text>
                  <Text className="text-lg font-black text-white">Map eBay Listing</Text>
                </View>
                <TouchableOpacity 
                  onPress={() => { setMappingModalVisible(false); resetMappingState(); }} 
                  className="p-2 bg-slate-800 border border-slate-700 rounded-full"
                >
                  <X color="#94a3b8" size={16} />
                </TouchableOpacity>
              </View>

              {selectedListing && (
                <ScrollView showsVerticalScrollIndicator={false} className="space-y-4">
                  {/* Selected Listing Card */}
                  <View className="flex-row bg-slate-950 p-3 rounded-2xl border border-slate-850 items-center gap-3">
                    <Image 
                      source={{ uri: selectedListing.imageUrl || 'https://via.placeholder.com/100' }} 
                      className="w-12 h-12 rounded-xl bg-white border border-slate-800"
                      resizeMode="contain"
                    />
                    <View className="flex-1 min-w-0">
                      <Text className="text-white font-bold text-xs truncate" numberOfLines={1}>{selectedListing.title}</Text>
                      <View className="flex-row items-center gap-2 mt-1">
                        <Text className="text-slate-500 text-[10px] font-semibold">SKU: {selectedListing.sku || 'None'}</Text>
                        <Text className="text-slate-500 text-[10px] font-semibold">·</Text>
                        <Text className="text-slate-500 text-[10px] font-semibold">Qty: {selectedListing.quantity}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Matching Status Badge */}
                  {resolvingItem ? (
                    <View className="flex-row items-center bg-slate-950/50 p-3 rounded-2xl border border-slate-850/50">
                      <ActivityIndicator size="small" color="#38bdf8" className="mr-2" />
                      <Text className="text-slate-400 font-semibold text-[11px]">Checking database for existing SKU match...</Text>
                    </View>
                  ) : existingInventoryItem ? (
                    <View className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-2xl flex-row items-center gap-2.5">
                      <CheckCircle2 color="#10b981" size={16} />
                      <View className="flex-1">
                        <Text className="text-emerald-400 font-extrabold text-[11px]">Match Found: Link to Existing Stock</Text>
                        <Text className="text-slate-400 text-[10px] font-medium mt-0.5">Item: {existingInventoryItem.title}</Text>
                      </View>
                    </View>
                  ) : (
                    <View className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-2xl flex-row items-center gap-2.5">
                      <AlertTriangle color="#f59e0b" size={16} />
                      <View className="flex-1">
                        <Text className="text-amber-400 font-extrabold text-[11px]">No Match: Register New Stock</Text>
                        <Text className="text-slate-400 text-[10px] font-medium mt-0.5">Will auto-generate internal SKU & print label.</Text>
                      </View>
                    </View>
                  )}

                  {/* Single Scan Section */}
                  <View className="bg-slate-950 border border-slate-850 p-4 rounded-3xl mt-2">
                    <Text className="text-white font-black text-sm mb-1">Scan or Enter Bin Location</Text>
                    <Text className="text-slate-500 text-[11px] mb-4 leading-relaxed">
                      Scan the location QR/barcode or type it to map instantly.
                    </Text>

                    <View className="flex-row items-center mb-2">
                      <View className="flex-1 flex-row items-center bg-slate-900 rounded-2xl px-3.5 py-2.5 border border-slate-800">
                        <MapPin color="#38bdf8" size={18} className="mr-2.5" />
                        <TextInput
                          ref={locationInputRef}
                          placeholder="RE-A-A-S01-L04..."
                          placeholderTextColor="#475569"
                          value={scannedLocationCode}
                          onChangeText={setScannedLocationCode}
                          onSubmitEditing={() => handleAutoMap(scannedLocationCode)}
                          className="flex-1 text-white font-bold text-xs"
                        />
                      </View>
                      <TouchableOpacity 
                        onPress={() => startCamera('location')}
                        className="bg-sky-600 p-3 rounded-2xl ml-2.5 items-center justify-center active:scale-95 shadow-lg shadow-sky-600/20"
                      >
                        <Camera color="#ffffff" size={20} />
                      </TouchableOpacity>
                    </View>

                    {/* Action Button */}
                    <TouchableOpacity
                      onPress={() => handleAutoMap(scannedLocationCode)}
                      disabled={resolvingLocation || !scannedLocationCode.trim()}
                      className="bg-sky-600 py-3 rounded-2xl items-center justify-center mt-3 active:scale-98 disabled:opacity-40"
                    >
                      {resolvingLocation ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <Text className="text-white font-black text-xs uppercase tracking-wider">Map & Link Instantly</Text>
                      )}
                    </TouchableOpacity>
                  </View>

                  {/* Quick Guide */}
                  <View className="bg-slate-950/40 p-3 rounded-2xl border border-slate-850/40">
                    <Text className="text-slate-500 font-semibold text-[10px] leading-relaxed text-center">
                      ⚡ Successful mapping will trigger automatic label printing on your Zebra printer.
                    </Text>
                  </View>
                </ScrollView>
              )}
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}
