import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  Barcode,
  Search,
  Camera,
  Plus,
  ArrowLeft,
  ArrowRight,
  Check,
  Package,
  DollarSign,
  Layers,
  MapPin,
  Sparkles,
  RefreshCw,
  X,
  HelpCircle,
  Tag,
  AlertTriangle,
  FileText,
  Truck,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { trpc } from '../../App';

type EntryMethod = 'none' | 'barcode' | 'search' | 'ai' | 'manual';

interface SpecificInput {
  name: string;
  value: string;
  isRequired?: boolean;
  isRecommended?: boolean;
}

const STEPS = [
  { id: 1, name: 'Start' },
  { id: 2, name: 'Photos' },
  { id: 3, name: 'Category' },
  { id: 4, name: 'Required Specs' },
  { id: 5, name: 'Recommended Specs' },
  { id: 6, name: 'Title' },
  { id: 7, name: 'Condition' },
  { id: 8, name: 'Pricing' },
  { id: 9, name: 'Location' },
  { id: 10, name: 'Policies' },
  { id: 11, name: 'Description' },
  { id: 12, name: 'Review' },
];

export default function CreateListingScreen({ route, navigation }: any) {
  const draftId = route?.params?.draftId;

  const [method, setEntryMethod] = useState<EntryMethod>('none');
  const [permission, requestPermission] = useCameraPermissions();
  const [currentStep, setCurrentStep] = useState(1);

  // --- Common States ---
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState<string | null>(null);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<number | null>(null);
  const [selectedLocationNode, setSelectedLocationNode] = useState<number | null>(null);
  const [locationCode, setLocationCode] = useState('');
  const [resolvedLocation, setResolvedLocation] = useState<any>(null);

  // --- Draft Form States ---
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [condition, setCondition] = useState<'new' | 'open_box' | 'used' | 'for_parts'>('used');
  const [categoryId, setCategoryId] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [specifics, setSpecifics] = useState<SpecificInput[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [savedSku, setSavedSku] = useState<string>('');
  const [itemLocationZip, setItemLocationZip] = useState<string>('');
  const [inventoryLocations, setInventoryLocations] = useState<any[]>([]);

  // --- Package Dimensions & Weight States (Preserved for Backend compatibility) ---
  const [packageWeight, setPackageWeight] = useState<string>('');
  const [packageLength, setPackageLength] = useState<string>('');
  const [packageWidth, setPackageWidth] = useState<string>('');
  const [packageHeight, setPackageHeight] = useState<string>('');
  const [handlingTime, setHandlingTime] = useState<string>('1');

  // --- Category Browser States ---
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [categorySearchResults, setCategorySearchResults] = useState<any[]>([]);
  const [rootCategories, setRootCategories] = useState<any[]>([]);
  const [currentCategoryPath, setCurrentCategoryPath] = useState<any[]>([]); // stack of { id, name }
  const [browsingCategories, setBrowsingCategories] = useState<any[]>([]);

  // --- eBay Policy States ---
  const [paymentPolicies, setPaymentPolicies] = useState<any[]>([]);
  const [returnPolicies, setReturnPolicies] = useState<any[]>([]);
  const [shippingPolicies, setShippingPolicies] = useState<any[]>([]);
  const [selectedPaymentPolicy, setSelectedPaymentPolicy] = useState<string>('');
  const [selectedReturnPolicy, setSelectedReturnPolicy] = useState<string>('');
  const [selectedShippingPolicy, setSelectedShippingPolicy] = useState<string>('');

  // --- Method 1: Barcode States ---
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scanningBarcode, setScanningBarcode] = useState(false);

  // --- Method 2: Search States ---
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchQueryResults] = useState<any[]>([]);
  const [selectedSearchItem, setSelectedSearchItem] = useState<any>(null);

  // --- Method 3: AI States ---
  const [takingPhoto, setTakingPhoto] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const cameraRef = useRef<any>(null);
  // --- Location Scan State ---
  const [isScanningLocation, setIsScanningLocation] = useState(false);

  // --- Backend tRPC Queries/Mutations ---
  const warehouseListQuery = (trpc as any).warehouse.list.useQuery();

  const draftQuery = (trpc as any).listingWizard.getDraft.useQuery(
    { id: draftId || 0 },
    { enabled: !!draftId }
  );
  
  const saveDraftMutation = (trpc as any).listingWizard.saveDraft.useMutation({
    onSuccess: () => {
      setLoading(false);
      setLoadingText(null);
      Alert.alert('Success', 'Listing draft created successfully!', [
        { text: 'OK', onPress: () => navigation.navigate('Listings') },
      ]);
    },
    onError: (err: any) => {
      setLoading(false);
      setLoadingText(null);
      Alert.alert('Error', err.message || 'Failed to save listing draft.');
    },
  });

  const searchSuggestionsQuery = (trpc as any).listingWizard.searchSuggestions.useQuery(
    { query: searchQuery },
    { enabled: searchQuery.length >= 2 }
  );

  const getEbaySuggestionDetailsQuery = (trpc as any).listingWizard.getEbaySuggestionDetails.useQuery(
    { itemId: selectedSearchItem?.id },
    { enabled: !!selectedSearchItem }
  );

  const analyzeListingImageMutation = (trpc as any).listingWizard.analyzeListingImage.useMutation({
    onSuccess: (data: any) => {
      setLoading(false);
      setLoadingText(null);
      setTitle(data.title || '');
      setCategoryId(data.categoryId || '');
      setCategoryName(data.categoryName || 'Uncategorized');
      setPrice(String(data.priceMax || data.priceMin || ''));
      setCondition(
        data.condition === 'NEW' ? 'new' :
        data.condition === 'OPEN_BOX' ? 'open_box' :
        data.condition === 'USED' ? 'used' : 'for_parts'
      );
      setDescription(data.conditionNotes || '');
      
      if (data.specifics) {
        const mappedSpecs = Object.entries(data.specifics).map(([k, v]: any) => ({
          name: k,
          value: Array.isArray(v) ? v.join(', ') : String(v),
        }));
        setSpecifics(mappedSpecs);
      } else {
        setSpecifics([]);
      }

      if (data.title === 'Suggested Product Title' && data.categoryName === 'Uncategorized') {
        Alert.alert(
          'AI Assist Limited',
          'The AI was unable to clearly identify the product from the photo. Default template fields have been loaded. Please fill in details manually.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'AI Analysis Complete',
          'AI successfully analyzed your photo and pre-populated the listing details!',
          [{ text: 'View Details' }]
        );
      }

      setEntryMethod('manual');
      setCurrentStep(2); // Start at Photos step with AI pre-populated fields
    },
    onError: (err: any) => {
      setLoading(false);
      setLoadingText(null);
      Alert.alert('AI Analysis Failed', err.message || 'Unable to analyze image. Falling back to manual entry.');
      setEntryMethod('manual');
      setCurrentStep(2);
    },
  });

  const searchLocationsQuery = (trpc as any).warehouse.searchLocations.useQuery(
    { query: locationCode, warehouseId: selectedWarehouse || undefined },
    { enabled: locationCode.length >= 2 }
  );

  // --- Dynamic Category & Aspect Queries ---
  const rootCategoriesQuery = (trpc as any).listingWizard.rootCategories.useQuery(
    undefined,
    { enabled: currentStep === 3 && browsingCategories.length === 0 }
  );

  const categoryChildrenQuery = (trpc as any).listingWizard.categoryChildren.useQuery(
    { categoryId: currentCategoryPath[currentCategoryPath.length - 1]?.id || '' },
    { enabled: currentStep === 3 && currentCategoryPath.length > 0 }
  );

  const categoryAspectsQuery = (trpc as any).listingWizard.categoryAspects.useQuery(
    { categoryId },
    { enabled: (currentStep === 4 || currentStep === 5) && !!categoryId }
  );

  const sellingOptionsQuery = (trpc as any).listingWizard.sellingOptions.useQuery(
    undefined,
    { enabled: currentStep === 10 }
  );

  const generateDescriptionMutation = (trpc as any).listingWizard.generateDescription.useMutation({
    onSuccess: (data: any) => {
      setLoading(false);
      setLoadingText(null);
      if (data.html) {
        setDescription(data.html);
        Alert.alert('AI Generated', 'Beautiful HTML description generated successfully!');
      }
    },
    onError: (err: any) => {
      setLoading(false);
      setLoadingText(null);
      Alert.alert('Generation Failed', err.message || 'Failed to generate AI description.');
    },
  });

  // Handle pre-populating from route params (Sell Similar workflow)
  useEffect(() => {
    if (route?.params?.prefill) {
      const item = route.params.prefill;
      setTitle(item.title || '');
      setPrice(String(item.price || item.listPrice || ''));
      setQuantity(String(item.quantity || '1'));
      setDescription(item.description || '');
      setCostPrice(String(item.costPrice || ''));
      if (item.sku) {
        setBarcodeInput(item.sku);
      }
      setEntryMethod('manual');
      setCurrentStep(2);
    }
  }, [route?.params?.prefill]);

  // Handle draft loading and hydration for Edit workflow
  useEffect(() => {
    if (draftQuery.data) {
      const draft = draftQuery.data;
      setTitle(draft.title || '');
      setDescription(draft.description || '');
      setPrice(draft.listPrice != null ? String(draft.listPrice) : '');
      setCostPrice(draft.costPrice != null ? String(draft.costPrice) : '');
      setQuantity(draft.quantity != null ? String(draft.quantity) : '1');
      setCondition((draft.condition || 'used') as any);
      setCategoryId(draft.categoryId || '');
      setCategoryName(draft.categoryName || '');
      setPhotos(Array.isArray(draft.photos) ? draft.photos : []);
      setSelectedWarehouse(draft.warehouseId || null);
      setSelectedLocationNode(draft.locationNodeId || null);
      setSavedSku(draft.sku || '');
      setItemLocationZip(draft.itemLocationZip || '');
      setSelectedPaymentPolicy(draft.paymentPolicyId || '');
      setSelectedReturnPolicy(draft.returnPolicyId || '');
      setSelectedShippingPolicy(draft.shippingPolicyId || '');
      setPackageWeight(draft.packageWeight != null ? String(draft.packageWeight) : '');
      setPackageLength(draft.packageLength != null ? String(draft.packageLength) : '');
      setPackageWidth(draft.packageWidth != null ? String(draft.packageWidth) : '');
      setPackageHeight(draft.packageHeight != null ? String(draft.packageHeight) : '');
      setHandlingTime(draft.handlingTime != null ? String(draft.handlingTime) : '1');

      if (draft.specifics) {
        setSpecifics(draft.specifics.map((s: any) => ({
          name: s.name,
          value: s.value,
          isRequired: s.isRequired,
          isRecommended: s.isRecommended,
        })));
      }

      setEntryMethod('manual');
      setCurrentStep(12); // Go straight to Review step when editing!
    }
  }, [draftQuery.data]);

  // Load warehouses on mount
  useEffect(() => {
    if (warehouseListQuery.data) {
      setWarehouses(warehouseListQuery.data);
      if (warehouseListQuery.data.length > 0) {
        setSelectedWarehouse(warehouseListQuery.data[0].id);
      }
    }
  }, [warehouseListQuery.data]);

  // Handle location node resolution from query
  useEffect(() => {
    if (searchLocationsQuery.data && searchLocationsQuery.data.length > 0) {
      const match = searchLocationsQuery.data.find((loc: any) => loc.type === 'location');
      if (match) {
        setResolvedLocation(match);
        setSelectedLocationNode(match.id);
      } else {
        setResolvedLocation(null);
        setSelectedLocationNode(null);
      }
    } else {
      setResolvedLocation(null);
      setSelectedLocationNode(null);
    }
  }, [searchLocationsQuery.data]);

  // Handle Suggestion details resolution
  useEffect(() => {
    if (getEbaySuggestionDetailsQuery.data) {
      const data = getEbaySuggestionDetailsQuery.data;
      setTitle(selectedSearchItem?.title || '');
      setCategoryId(data.categoryId || '');
      setCategoryName(data.categoryName || 'Uncategorized');
      setPrice(String(data.listingPrice || ''));
      setDescription(data.description || '');
      if (data.specifics) {
        const mappedSpecs = Object.entries(data.specifics).map(([k, v]: any) => ({
          name: k,
          value: Array.isArray(v) ? v.join(', ') : String(v),
        }));
        setSpecifics(mappedSpecs);
      }
      setEntryMethod('manual');
      setCurrentStep(2);
    }
  }, [getEbaySuggestionDetailsQuery.data]);

  // Trigger search on typing query
  useEffect(() => {
    if (searchSuggestionsQuery.data) {
      const suggestionsList = searchSuggestionsQuery.data.suggestions || [];
      const ebaySuggestions = suggestionsList.filter((item: any) => item.source === 'ebay');
      setSearchQueryResults(ebaySuggestions);
    }
  }, [searchSuggestionsQuery.data]);

  // Handle Root Categories loading
  useEffect(() => {
    if (rootCategoriesQuery.data?.categories) {
      setRootCategories(rootCategoriesQuery.data.categories);
      setBrowsingCategories(rootCategoriesQuery.data.categories);
    }
  }, [rootCategoriesQuery.data]);

  // Handle Category Children loading
  useEffect(() => {
    if (categoryChildrenQuery.data?.categories) {
      setBrowsingCategories(categoryChildrenQuery.data.categories);
    }
  }, [categoryChildrenQuery.data]);

  // Handle dynamic aspects loading
  useEffect(() => {
    if (categoryAspectsQuery.data?.aspects) {
      const aspects = categoryAspectsQuery.data.aspects;
      // Pre-fill specifics list with dynamic aspects that aren't already there
      const currentSpecsMap = new Map(specifics.map((s) => [s.name, s.value]));
      const newSpecs: SpecificInput[] = [];

      aspects.forEach((aspect: any) => {
        const existingValue = currentSpecsMap.get(aspect.name);
        newSpecs.push({
          name: aspect.name,
          value: existingValue || '',
          isRequired: aspect.required,
          isRecommended: aspect.recommended,
        });
      });

      // Also append any custom specs the user manually added that are not part of the standard aspects
      const aspectNames = new Set(aspects.map((a: any) => a.name));
      specifics.forEach((s) => {
        if (!aspectNames.has(s.name)) {
          newSpecs.push(s);
        }
      });

      setSpecifics(newSpecs);
    }
  }, [categoryAspectsQuery.data]);

  // Handle Selling Options (Policies) loading
  useEffect(() => {
    if (sellingOptionsQuery.data) {
      const data = sellingOptionsQuery.data;
      
      // Support both raw nested eBay shape and normalized flat array shape
      const rawPayment = data.paymentPolicies?.paymentPolicies;
      const normPayment = Array.isArray(data.paymentPolicies) ? data.paymentPolicies : [];
      const resolvedPayment = rawPayment || normPayment.map((p: any) => ({ policyId: p.id, name: p.name }));
      setPaymentPolicies(resolvedPayment);

      const rawReturn = data.returnPolicies?.returnPolicies;
      const normReturn = Array.isArray(data.returnPolicies) ? data.returnPolicies : [];
      const resolvedReturn = rawReturn || normReturn.map((p: any) => ({ policyId: p.id, name: p.name }));
      setReturnPolicies(resolvedReturn);

      const rawShipping = data.shippingPolicies?.fulfillmentPolicies;
      const normShipping = Array.isArray(data.shippingPolicies) ? data.shippingPolicies : [];
      const resolvedShipping = rawShipping || normShipping.map((p: any) => ({ policyId: p.id, name: p.name }));
      setShippingPolicies(resolvedShipping);

      const locs = data.inventoryLocations || [];
      setInventoryLocations(locs);

      // Auto select first policy/location if available and not already set
      if (resolvedPayment.length > 0 && !selectedPaymentPolicy) {
        setSelectedPaymentPolicy(resolvedPayment[0].policyId);
      }
      if (resolvedReturn.length > 0 && !selectedReturnPolicy) {
        setSelectedReturnPolicy(resolvedReturn[0].policyId);
      }
      if (resolvedShipping.length > 0 && !selectedShippingPolicy) {
        setSelectedShippingPolicy(resolvedShipping[0].policyId);
      }
      if (locs.length > 0 && !itemLocationZip) {
        const firstLoc = locs[0];
        setItemLocationZip(`${firstLoc.merchantLocationKey}::${firstLoc.postalCode || ""}`);
      }
    }
  }, [sellingOptionsQuery.data, selectedPaymentPolicy, selectedReturnPolicy, selectedShippingPolicy, itemLocationZip]);

  // --- Form Actions ---
  const handleSaveDraft = () => {
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter a title for the listing.');
      return;
    }
    if (!price.trim() || isNaN(Number(price))) {
      Alert.alert('Required', 'Please enter a valid listing price.');
      return;
    }

    setLoadingText('Saving listing draft...');
    setLoading(true);
    const draftData: any = {
      id: draftId || undefined,
      title,
      description,
      listingPrice: Number(price),
      costPrice: costPrice ? Number(costPrice) : undefined,
      quantity: Number(quantity),
      condition,
      categoryId,
      categoryName,
      categoryPath: categoryName,
      warehouseId: selectedWarehouse || undefined,
      locationNodeId: selectedLocationNode || undefined,
      paymentPolicyId: selectedPaymentPolicy || undefined,
      returnPolicyId: selectedReturnPolicy || undefined,
      shippingPolicyId: selectedShippingPolicy || undefined,
      itemLocationZip: itemLocationZip || undefined,
      photos,
      specifics: specifics.map((s) => ({
        name: s.name,
        value: s.value,
        isRequired: s.isRequired,
        isRecommended: s.isRecommended,
      })),
      packageWeight: packageWeight ? Number(packageWeight) : undefined,
      packageLength: packageLength ? Number(packageLength) : undefined,
      packageWidth: packageWidth ? Number(packageWidth) : undefined,
      packageHeight: packageHeight ? Number(packageHeight) : undefined,
      handlingTime: handlingTime ? Number(handlingTime) : 1,
    };

    saveDraftMutation.mutate(draftData);
  };

  const handleBarcodeScanned = ({ data }: any) => {
    setScanningBarcode(false);
    setBarcodeInput(data);
    handleBarcodeSearch(data);
  };

  const handleLocationScanned = ({ data }: any) => {
    setIsScanningLocation(false);
    setLocationCode(data);
  };

  const startLocationScan = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert('Camera Permission Required', 'Please enable camera access in your device settings.');
        return;
      }
    }
    setIsScanningLocation(true);
  };

  const handleBarcodeSearch = (code: string) => {
    if (!code.trim()) return;
    setLoading(true);
    setSearchQuery(code);
    setEntryMethod('search');
    setLoading(false);
  };

  const takePhotoAndAnalyze = async (isAiFlow: boolean = false) => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert('Camera Permission Required', 'Please enable camera access in your device settings.');
        return;
      }
    }

    if (isAiFlow) {
      setEntryMethod('ai');
    }

    setIsCameraReady(false);
    setTakingPhoto(true);
  };

  const uploadPhotoToBackend = async (base64Data: string, fileName: string): Promise<string> => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const response = await fetch('https://stocknestpro.com/api/upload/listing-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          fileName,
          mimeType: 'image/jpeg',
          dataUrl: `data:image/jpeg;base64,${base64Data}`,
        }),
      });

      if (!response.ok) {
        const errPayload = await response.json().catch(() => ({}));
        throw new Error(errPayload.error || 'Failed to upload photo to StockNestPro storage.');
      }

      const payload = await response.json();
      if (!payload.url) throw new Error('No URL returned from upload.');
      return payload.url;
    } catch (error: any) {
      console.error('Photo upload failed:', error);
      throw error;
    }
  };

  const handleCapture = async () => {
    if (!isCameraReady) {
      Alert.alert('Camera Not Ready', 'Please wait for the camera preview to load.');
      return;
    }
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.5,
          base64: true,
        });
        if (!photo || !photo.base64) {
          throw new Error('Failed to capture image data.');
        }
        setPhotoUri(photo.uri);
        setPhotoBase64(photo.base64);
        setTakingPhoto(false);

        if (method === 'ai') {
          setLoadingText('Uploading and AI Analyzing Product Photo...\nThis may take 10-15 seconds.');
          setLoading(true);
          
          // Upload photo first
          const uploadedUrl = await uploadPhotoToBackend(photo.base64, `ai-photo-${Date.now()}.jpg`);
          setPhotos([uploadedUrl]);

          // Run AI Analysis mutation
          analyzeListingImageMutation.mutate({ imageBase64: photo.base64 });
        } else {
          setLoadingText('Uploading photo to secure storage...');
          setLoading(true);
          
          // Upload photo first
          const uploadedUrl = await uploadPhotoToBackend(photo.base64, `photo-${Date.now()}.jpg`);
          setPhotos([...photos, uploadedUrl]);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Photo capture failed:', err);
        Alert.alert('Capture Failed', err.message || 'Failed to take photo. Please try again.');
        setTakingPhoto(false);
        setLoading(false);
      }
    }
  };

  const addSpecific = () => {
    setSpecifics([...specifics, { name: '', value: '' }]);
  };

  const removeSpecific = (index: number) => {
    const updated = [...specifics];
    updated.splice(index, 1);
    setSpecifics(updated);
  };

  const updateSpecific = (index: number, text: string) => {
    const updated = [...specifics];
    updated[index].value = text;
    setSpecifics(updated);
  };

  const updateCustomSpecificName = (index: number, name: string) => {
    const updated = [...specifics];
    updated[index].name = name;
    setSpecifics(updated);
  };

  const handleGenerateDescription = () => {
    if (!title.trim()) {
      Alert.alert('Required', 'Please fill in the Product Title (Step 6) before generating a description.');
      return;
    }
    setLoadingText('Generating AI Listing Description...');
    setLoading(true);

    const specsMap: Record<string, string> = {};
    specifics.forEach((s) => {
      if (s.name && s.value) specsMap[s.name] = s.value;
    });

    generateDescriptionMutation.mutate({
      title,
      categoryName,
      condition: condition.toUpperCase(),
      specifics: specsMap,
      mode: 'standard',
    });
  };

  // --- STEP NAVIGATION VALIDATION ---
  const canGoNext = () => {
    if (currentStep === 1) return method !== 'none';
    if (currentStep === 3) return !!categoryId; // Category is required
    if (currentStep === 4) {
      // Validate all required aspects are filled
      const missingRequired = specifics.filter((s) => s.isRequired && !s.value.trim());
      return missingRequired.length === 0;
    }
    if (currentStep === 6) return title.trim().length > 0;
    if (currentStep === 8) return price.trim().length > 0 && !isNaN(Number(price));
    if (currentStep === 9) return !!selectedWarehouse;
    return true;
  };

  const handleNextStep = () => {
    if (!canGoNext()) {
      if (currentStep === 3) {
        Alert.alert('Category Required', 'Please select an eBay Category before proceeding.');
      } else if (currentStep === 4) {
        const missingRequired = specifics.filter((s) => s.isRequired && !s.value.trim());
        Alert.alert(
          'Required Fields Missing',
          `Please fill in all required aspects: ${missingRequired.map((m) => m.name).join(', ')}`
        );
      } else if (currentStep === 6) {
        Alert.alert('Title Required', 'Please enter a valid product title.');
      } else if (currentStep === 8) {
        Alert.alert('Price Required', 'Please enter a valid listing price.');
      }
      return;
    }

    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      setEntryMethod('none');
    }
  };

  // --- RENDER METHODS ---

  // Wizard Step Progress Bar
  const renderStepProgress = () => {
    const progressPercent = (currentStep / STEPS.length) * 100;
    return (
      <View className="bg-slate-900 border-b border-slate-800 px-4 py-3">
        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-slate-400 text-xs font-bold uppercase tracking-widest">
            Step {currentStep} of {STEPS.length}
          </Text>
          <Text className="text-sky-400 font-black text-sm">
            {STEPS[currentStep - 1].name}
          </Text>
        </View>
        <View className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <View className="h-full bg-sky-500" style={{ width: `${progressPercent}%` }} />
        </View>
      </View>
    );
  };

  // Header
  const renderHeader = (titleText: string) => (
    <View className="flex-row items-center justify-between px-4 pt-14 pb-4 bg-slate-900 border-b border-slate-800">
      <TouchableOpacity
        onPress={handlePrevStep}
        className="p-2 rounded-xl bg-slate-800 active:scale-95"
      >
        <ArrowLeft color="#94a3b8" size={20} />
      </TouchableOpacity>
      <Text className="text-white text-lg font-black">{titleText}</Text>
      <View className="w-10" />
    </View>
  );

  // Method 1: Barcode Scan Screen
  if (takingPhoto) {
    return (
      <View className="flex-1 bg-black">
        <CameraView
          ref={cameraRef}
          style={{ flex: 1 }}
          facing="back"
          mode="picture"
          onCameraReady={() => setIsCameraReady(true)}
        />
        <View className="absolute bottom-0 left-0 right-0 flex-row justify-between items-center px-8 pb-10 bg-black/40 pt-4">
          <TouchableOpacity
            onPress={() => setTakingPhoto(false)}
            className="p-4 rounded-full bg-slate-900/80 active:scale-95"
          >
            <X color="#ffffff" size={24} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleCapture}
            disabled={!isCameraReady}
            className={`w-20 h-20 rounded-full border-4 justify-center items-center active:scale-90 ${
              isCameraReady ? 'bg-white border-slate-300' : 'bg-slate-700 border-slate-600 opacity-50'
            }`}
          >
            {isCameraReady ? (
              <View className="w-16 h-16 rounded-full bg-sky-500" />
            ) : (
              <ActivityIndicator size="small" color="#ffffff" />
            )}
          </TouchableOpacity>
          <View className="w-14" />
        </View>
      </View>
    );
  }

  if (loading && loadingText) {
    return (
      <View className="flex-1 bg-slate-950 justify-center items-center p-6">
        <ActivityIndicator size="large" color="#0284c7" />
        <Text className="text-white text-lg font-black mt-6 text-center">{loadingText}</Text>
        <Text className="text-slate-400 text-sm mt-2 text-center">We are processing your request. Please do not close the app.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-slate-950"
    >
      {/* 1. Main Entry Method Hub */}
      {method === 'none' && (
        <View className="flex-1">
          <View className="px-4 pt-14 pb-6 bg-slate-900 border-b border-slate-800">
            <Text className="text-white text-2xl font-black">Create Listing</Text>
            <Text className="text-slate-400 text-sm mt-1">Select an entry method to start your eBay draft.</Text>
          </View>

          <ScrollView className="flex-1 px-4 py-6" contentContainerStyle={{ paddingBottom: 40 }}>
            <TouchableOpacity
              onPress={() => {
                setEntryMethod('barcode');
                setScanningBarcode(true);
              }}
              className="flex-row items-center bg-slate-900 border border-slate-800 p-5 rounded-2xl mb-4 active:scale-98"
            >
              <View className="w-12 h-12 rounded-xl bg-sky-500/10 justify-center items-center mr-4">
                <Barcode color="#0ea5e9" size={24} />
              </View>
              <View className="flex-1">
                <Text className="text-white font-bold text-base">Scan Barcode / UPC</Text>
                <Text className="text-slate-400 text-xs mt-1">For brand new items or electronics with retail barcodes.</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setEntryMethod('search')}
              className="flex-row items-center bg-slate-900 border border-slate-800 p-5 rounded-2xl mb-4 active:scale-98"
            >
              <View className="w-12 h-12 rounded-xl bg-indigo-500/10 justify-center items-center mr-4">
                <Search color="#6366f1" size={24} />
              </View>
              <View className="flex-1">
                <Text className="text-white font-bold text-base">Search eBay Suggestions</Text>
                <Text className="text-slate-400 text-xs mt-1">Type keywords like "Nike red hoodie" to find similar listings.</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => takePhotoAndAnalyze(true)}
              className="flex-row items-center bg-slate-900 border border-slate-800 p-5 rounded-2xl mb-4 active:scale-98"
            >
              <View className="w-12 h-12 rounded-xl bg-purple-500/10 justify-center items-center mr-4">
                <Sparkles color="#a855f7" size={24} />
              </View>
              <View className="flex-1">
                <Text className="text-white font-bold text-base">Take Photo + AI Assist</Text>
                <Text className="text-slate-400 text-xs mt-1">Use AI to scan clothing, parts, or antiques and generate listing details.</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setTitle('');
                setDescription('');
                setPrice('');
                setCostPrice('');
                setQuantity('1');
                setCategoryId('');
                setCategoryName('');
                setSpecifics([]);
                setPhotos([]);
                setEntryMethod('manual');
                setCurrentStep(2); // Start at step 2 (Photos)
              }}
              className="flex-row items-center bg-slate-900 border border-slate-800 p-5 rounded-2xl mb-4 active:scale-98"
            >
              <View className="w-12 h-12 rounded-xl bg-emerald-500/10 justify-center items-center mr-4">
                <Plus color="#10b981" size={24} />
              </View>
              <View className="flex-1">
                <Text className="text-white font-bold text-base">Manual Quick Listing</Text>
                <Text className="text-slate-400 text-xs mt-1">For unique, custom, or rare items without a database match.</Text>
              </View>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* 2. Method 1: Barcode Scan Active */}
      {method === 'barcode' && (
        <View className="flex-1">
          {renderHeader('Scan Barcode / UPC')}
          {scanningBarcode ? (
            <View className="flex-1 justify-center items-center bg-black">
              <CameraView
                onBarcodeScanned={handleBarcodeScanned}
                className="w-full h-80 justify-center items-center"
                facing="back"
              >
                <View className="w-64 h-32 border-2 border-dashed border-sky-500 rounded-lg justify-center items-center">
                  <Text className="text-sky-500 font-bold bg-black/50 px-2 py-1 rounded">Align Barcode Here</Text>
                </View>
              </CameraView>
              <TouchableOpacity
                onPress={() => setScanningBarcode(false)}
                className="mt-8 px-6 py-3 bg-slate-800 rounded-xl active:scale-95"
              >
                <Text className="text-white font-bold">Enter Manually</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="flex-1 p-6 justify-center">
              <Text className="text-white text-lg font-bold mb-2">Enter Barcode / UPC Manually</Text>
              <TextInput
                value={barcodeInput}
                onChangeText={setBarcodeInput}
                placeholder="e.g. 191234567890"
                placeholderTextColor="#64748b"
                keyboardType="numeric"
                className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-white text-base mb-6"
              />
              <TouchableOpacity
                onPress={() => handleBarcodeSearch(barcodeInput)}
                className="bg-sky-600 p-4 rounded-xl items-center active:scale-95"
              >
                <Text className="text-white font-black">Search Barcode</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setScanningBarcode(true)}
                className="mt-4 p-4 border border-slate-800 rounded-xl items-center active:scale-95"
              >
                <Text className="text-slate-400 font-bold">Open Camera Scanner</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* 3. Method 2: Search eBay Suggestions */}
      {method === 'search' && (
        <View className="flex-1">
          {renderHeader('Search eBay Catalog')}
          <View className="p-4">
            <View className="flex-row items-center bg-slate-900 border border-slate-800 rounded-xl px-4 py-1">
              <Search color="#64748b" size={20} className="mr-2" />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="e.g. Nike red hoodie L"
                placeholderTextColor="#64748b"
                className="flex-1 text-white py-3 text-base"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <X color="#64748b" size={20} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {searchSuggestionsQuery.isLoading ? (
            <View className="flex-1 justify-center items-center">
              <ActivityIndicator size="large" color="#0ea5e9" />
              <Text className="text-slate-400 text-sm mt-2">Searching eBay catalog...</Text>
            </View>
          ) : (
            <ScrollView className="flex-1 px-4">
              {searchResults.length === 0 ? (
                <View className="py-12 items-center">
                  <HelpCircle color="#334155" size={48} />
                  <Text className="text-slate-400 font-bold mt-4 text-center">No matching similar listings found</Text>
                  <Text className="text-slate-500 text-xs mt-1 text-center px-6">
                    Try searching for different keywords or create a manual listing below.
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setTitle(searchQuery);
                      setEntryMethod('manual');
                      setCurrentStep(2);
                    }}
                    className="mt-6 bg-slate-900 border border-slate-800 px-6 py-3 rounded-xl"
                  >
                    <Text className="text-white font-bold">Create Manual Draft with "{searchQuery}"</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                searchResults.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => {
                      setSelectedSearchItem(item);
                    }}
                    className="flex-row items-center bg-slate-900 border border-slate-800 p-3 rounded-xl mb-3 active:scale-98"
                  >
                    {item.thumbnail ? (
                      <Image source={{ uri: item.thumbnail }} className="w-14 h-14 rounded-lg mr-3" />
                    ) : (
                      <View className="w-14 h-14 bg-slate-800 rounded-lg justify-center items-center mr-3">
                        <Package color="#64748b" size={24} />
                      </View>
                    )}
                    <View className="flex-1">
                      <Text className="text-white font-bold text-sm" numberOfLines={2}>
                        {item.title}
                      </Text>
                      <View className="flex-row items-center justify-between mt-1">
                        <Text className="text-slate-400 text-xs" numberOfLines={1}>
                          {item.categoryName}
                        </Text>
                        <Text className="text-emerald-500 font-black text-sm">${item.price}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          )}

          {selectedSearchItem && (
            <View className="absolute inset-0 bg-black/80 justify-center p-6">
              <View className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <Text className="text-white text-lg font-black mb-4">Resolving Template Details</Text>
                <ActivityIndicator size="large" color="#0ea5e9" className="my-6" />
                <Text className="text-slate-400 text-sm text-center">
                  Fetching item specifics, condition metrics, and recommended eBay category fields...
                </Text>
              </View>
            </View>
          )}
        </View>
      )}

      {/* 4. The 12-Step Listing Wizard Stepper */}
      {method === 'manual' && (
        <View className="flex-1">
          {renderHeader(STEPS[currentStep - 1].name)}
          {renderStepProgress()}

          <ScrollView className="flex-1 px-4 py-6" contentContainerStyle={{ paddingBottom: 60 }}>
            
            {/* STEP 2: Photos */}
            {currentStep === 2 && (
              <View className="space-y-6">
                <Text className="text-white text-lg font-black mb-2">Product Photos</Text>
                <Text className="text-slate-400 text-sm mb-4">
                  Add photos of your item. Good photos increase sales by up to 80%.
                </Text>

                <View className="flex-row flex-wrap gap-4 mb-6">
                  {photos.map((uri, idx) => (
                    <View key={idx} className="relative w-24 h-24 rounded-xl border border-slate-800 overflow-hidden">
                      <Image source={{ uri }} className="w-full h-full" />
                      <TouchableOpacity
                        onPress={() => {
                          const updated = [...photos];
                          updated.splice(idx, 1);
                          setPhotos(updated);
                        }}
                        className="absolute top-1 right-1 bg-black/70 p-1 rounded-full"
                      >
                        <X color="#ffffff" size={14} />
                      </TouchableOpacity>
                    </View>
                  ))}

                  <TouchableOpacity
                    onPress={() => takePhotoAndAnalyze(false)}
                    className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-800 justify-center items-center bg-slate-900/40 active:scale-95"
                  >
                    <Camera color="#64748b" size={24} />
                    <Text className="text-slate-500 text-xs font-bold mt-2">Add Photo</Text>
                  </TouchableOpacity>
                </View>

                {photos.length === 0 && (
                  <View className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 items-center">
                    <Camera color="#475569" size={40} />
                    <Text className="text-slate-400 font-bold mt-4">No Photos Added Yet</Text>
                    <Text className="text-slate-500 text-xs text-center mt-1">
                      You can proceed without photos, but we recommend adding at least one.
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* STEP 3: Category Browser */}
            {currentStep === 3 && (
              <View>
                <Text className="text-white text-lg font-black mb-2">eBay Category Selection</Text>
                <Text className="text-slate-400 text-sm mb-4">
                  Select the target category. This determines the dynamic item specifics required by eBay.
                </Text>

                {/* Category Breadcrumbs */}
                {currentCategoryPath.length > 0 && (
                  <View className="flex-row flex-wrap items-center bg-slate-900/50 p-3 rounded-xl mb-4 border border-slate-800">
                    <TouchableOpacity
                      onPress={() => {
                        setCurrentCategoryPath([]);
                        setBrowsingCategories(rootCategories);
                      }}
                    >
                      <Text className="text-sky-500 text-xs font-bold">Root</Text>
                    </TouchableOpacity>
                    {currentCategoryPath.map((node, idx) => (
                      <React.Fragment key={node.id}>
                        <ChevronRight color="#64748b" size={12} className="mx-1" />
                        <TouchableOpacity
                          disabled={idx === currentCategoryPath.length - 1}
                          onPress={() => {
                            const newPath = currentCategoryPath.slice(0, idx + 1);
                            setCurrentCategoryPath(newPath);
                          }}
                        >
                          <Text className={`${idx === currentCategoryPath.length - 1 ? 'text-slate-300' : 'text-sky-500'} text-xs font-bold`}>
                            {node.name}
                          </Text>
                        </TouchableOpacity>
                      </React.Fragment>
                    ))}
                  </View>
                )}

                {/* Category Search */}
                <View className="flex-row items-center bg-slate-900 border border-slate-800 rounded-xl px-4 py-1 mb-4">
                  <Search color="#64748b" size={18} className="mr-2" />
                  <TextInput
                    value={categorySearchQuery}
                    onChangeText={setCategorySearchQuery}
                    placeholder="Search category e.g. laptop, shirt..."
                    placeholderTextColor="#64748b"
                    className="flex-1 text-white py-3 text-sm"
                  />
                  {categorySearchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setCategorySearchQuery('')}>
                      <X color="#64748b" size={18} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Category Selection Status */}
                {categoryId ? (
                  <View className="flex-row items-center bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl mb-4">
                    <Check color="#10b981" size={20} className="mr-3" />
                    <View className="flex-1">
                      <Text className="text-emerald-400 font-bold text-xs uppercase tracking-wider">Selected Category</Text>
                      <Text className="text-white text-sm font-bold mt-1">{categoryName}</Text>
                      <Text className="text-slate-400 text-xs mt-1">ID: {categoryId}</Text>
                    </View>
                  </View>
                ) : (
                  <View className="flex-row items-center bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl mb-4">
                    <AlertTriangle color="#f59e0b" size={20} className="mr-3" />
                    <Text className="text-amber-400 text-xs font-bold flex-1">
                      No category selected. Please select or search a category below.
                    </Text>
                  </View>
                )}

                {/* Category List */}
                {rootCategoriesQuery.isLoading || categoryChildrenQuery.isFetching ? (
                  <View className="py-12 justify-center items-center">
                    <ActivityIndicator size="small" color="#0ea5e9" />
                    <Text className="text-slate-500 text-xs mt-2">Loading categories...</Text>
                  </View>
                ) : (
                  <View className="bg-slate-900/30 border border-slate-800 rounded-2xl overflow-hidden">
                    {browsingCategories.map((cat: any) => (
                      <TouchableOpacity
                        key={cat.id}
                        onPress={() => {
                          if (cat.leaf) {
                            setCategoryId(cat.id);
                            setCategoryName(cat.name);
                          } else {
                            setCurrentCategoryPath([...currentCategoryPath, { id: cat.id, name: cat.name }]);
                          }
                        }}
                        className="flex-row justify-between items-center p-4 border-b border-slate-800/60 active:bg-slate-900"
                      >
                        <View className="flex-1 pr-4">
                          <Text className="text-white text-sm font-bold">{cat.name}</Text>
                          {cat.leaf && (
                            <Text className="text-emerald-500 text-xs font-bold mt-1 uppercase tracking-wider">
                              Leaf Category (Selectable)
                            </Text>
                          )}
                        </View>
                        {!cat.leaf && <ChevronRight color="#64748b" size={16} />}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* STEP 4: Required Aspects */}
            {currentStep === 4 && (
              <View>
                <Text className="text-white text-lg font-black mb-2">Required Item Specifics</Text>
                <Text className="text-slate-400 text-sm mb-4">
                  eBay requires these details to list items in the **{categoryName}** category.
                </Text>

                {categoryAspectsQuery.isLoading ? (
                  <View className="py-12 justify-center items-center">
                    <ActivityIndicator size="small" color="#0ea5e9" />
                    <Text className="text-slate-500 text-xs mt-2">Loading required specifics...</Text>
                  </View>
                ) : (
                  <View className="space-y-4">
                    {specifics.filter((s) => s.isRequired).length === 0 ? (
                      <View className="bg-slate-900/40 p-6 rounded-2xl border border-slate-800 items-center">
                        <Check color="#10b981" size={32} />
                        <Text className="text-slate-400 font-bold mt-4">No Required Specifics</Text>
                        <Text className="text-slate-500 text-xs text-center mt-1">
                          This category does not have any required specifics. You can skip to recommended ones.
                        </Text>
                      </View>
                    ) : (
                      specifics
                        .map((spec, idx) => ({ spec, originalIdx: idx }))
                        .filter(({ spec }) => spec.isRequired)
                        .map(({ spec, originalIdx }) => (
                          <View key={originalIdx} className="mb-4">
                            <Text className="text-slate-300 font-bold text-xs uppercase tracking-wider mb-2">
                              {spec.name} <Text className="text-red-500">*</Text>
                            </Text>
                            <TextInput
                              value={spec.value}
                              onChangeText={(txt) => updateSpecific(originalIdx, txt)}
                              placeholder={`Enter ${spec.name}...`}
                              placeholderTextColor="#64748b"
                              className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-white text-base"
                            />
                          </View>
                        ))
                    )}
                  </View>
                )}
              </View>
            )}

            {/* STEP 5: Recommended Aspects */}
            {currentStep === 5 && (
              <View>
                <Text className="text-white text-lg font-black mb-2">Recommended Specifics</Text>
                <Text className="text-slate-400 text-sm mb-4">
                  These details make your listing easier to find in eBay searches.
                </Text>

                <View className="space-y-4">
                  {specifics
                    .map((spec, idx) => ({ spec, originalIdx: idx }))
                    .filter(({ spec }) => !spec.isRequired)
                    .map(({ spec, originalIdx }) => (
                      <View key={originalIdx} className="mb-4 bg-slate-900/20 border border-slate-800/40 p-4 rounded-2xl">
                        <View className="flex-row justify-between items-center mb-2">
                          <Text className="text-slate-300 font-bold text-xs uppercase tracking-wider">
                            {spec.name}
                          </Text>
                          <TouchableOpacity onPress={() => removeSpecific(originalIdx)}>
                            <X color="#ef4444" size={16} />
                          </TouchableOpacity>
                        </View>
                        <TextInput
                          value={spec.value}
                          onChangeText={(txt) => updateSpecific(originalIdx, txt)}
                          placeholder={`Enter ${spec.name}...`}
                          placeholderTextColor="#64748b"
                          className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-white text-sm"
                        />
                      </View>
                    ))}

                  <TouchableOpacity
                    onPress={addSpecific}
                    className="flex-row justify-center items-center p-4 bg-slate-900 border border-slate-800 rounded-xl mt-4 active:scale-95"
                  >
                    <Plus color="#0ea5e9" size={16} className="mr-2" />
                    <Text className="text-sky-500 font-bold text-sm">Add Custom Specific</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* STEP 6: Title */}
            {currentStep === 6 && (
              <View>
                <Text className="text-white text-lg font-black mb-2">Product Title</Text>
                <Text className="text-slate-400 text-sm mb-4">
                  Create a descriptive title. Include brand, model, size, color, and key specs. Max 80 characters.
                </Text>

                <View className="mb-4">
                  <TextInput
                    value={title}
                    onChangeText={setTitle}
                    placeholder="e.g. Nike Men's Pullover Hoodie Red Large"
                    placeholderTextColor="#64748b"
                    maxLength={80}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-white text-base"
                  />
                  <Text className={`${title.length > 70 ? 'text-amber-500' : 'text-slate-500'} text-right text-xs mt-2`}>
                    {title.length}/80 characters
                  </Text>
                </View>
              </View>
            )}

            {/* STEP 7: Condition */}
            {currentStep === 7 && (
              <View>
                <Text className="text-white text-lg font-black mb-2">Item Condition</Text>
                <Text className="text-slate-400 text-sm mb-4">
                  Select the standard eBay condition that matches your item.
                </Text>

                <View className="space-y-3">
                  {(['new', 'open_box', 'used', 'for_parts'] as const).map((cond) => (
                    <TouchableOpacity
                      key={cond}
                      onPress={() => setCondition(cond)}
                      className={`flex-row justify-between items-center p-4 rounded-xl border ${
                        condition === cond ? 'bg-sky-500/10 border-sky-500' : 'bg-slate-900 border-slate-800'
                      } active:scale-98`}
                    >
                      <View>
                        <Text className="text-white font-bold text-sm uppercase">
                          {cond.replace('_', ' ')}
                        </Text>
                        <Text className="text-slate-400 text-xs mt-1">
                          {cond === 'new' && 'Brand new, unused, unopened, in original packaging.'}
                          {cond === 'open_box' && 'Excellent condition, original packaging open or missing.'}
                          {cond === 'used' && 'Fully operational, has signs of wear/cosmetic use.'}
                          {cond === 'for_parts' && 'Does not function as intended, missing parts or damaged.'}
                        </Text>
                      </View>
                      {condition === cond && <Check color="#0ea5e9" size={20} />}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* STEP 8: Pricing */}
            {currentStep === 8 && (
              <View>
                <Text className="text-white text-lg font-black mb-2">Pricing & Costs</Text>
                <Text className="text-slate-400 text-sm mb-4">
                  Set your listing price and record your cost of acquisition.
                </Text>

                <View className="space-y-4">
                  <View>
                    <Text className="text-slate-400 font-bold text-xs uppercase tracking-wider mb-2">Listing Price ($)</Text>
                    <View className="flex-row items-center bg-slate-900 border border-slate-800 rounded-xl px-4">
                      <DollarSign color="#64748b" size={16} />
                      <TextInput
                        value={price}
                        onChangeText={setPrice}
                        placeholder="29.99"
                        placeholderTextColor="#64748b"
                        keyboardType="numeric"
                        className="flex-1 text-white py-4 ml-1 text-base"
                      />
                    </View>
                  </View>

                  <View>
                    <Text className="text-slate-400 font-bold text-xs uppercase tracking-wider mb-2">Acquisition Cost ($)</Text>
                    <View className="flex-row items-center bg-slate-900 border border-slate-800 rounded-xl px-4">
                      <DollarSign color="#64748b" size={16} />
                      <TextInput
                        value={costPrice}
                        onChangeText={setCostPrice}
                        placeholder="10.00"
                        placeholderTextColor="#64748b"
                        keyboardType="numeric"
                        className="flex-1 text-white py-4 ml-1 text-base"
                      />
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* STEP 9: Storage Location */}
            {currentStep === 9 && (
              <View>
                <Text className="text-white text-lg font-black mb-2">Warehouse & Storage Location</Text>
                <Text className="text-slate-400 text-sm mb-4">
                  Assign this item to a physical warehouse location. Critical for picking fulfillment.
                </Text>

                <View className="bg-slate-900/40 border border-slate-800 p-4 rounded-2xl">
                  <Text className="text-slate-400 font-bold text-xs mb-2">Target Warehouse</Text>
                  <View className="bg-slate-900 border border-slate-800 rounded-xl px-4 mb-4">
                    <TextInput
                      value={warehouses.find((w) => w.id === selectedWarehouse)?.name || 'Loading Warehouse...'}
                      editable={false}
                      className="text-white py-3 text-base font-bold"
                    />
                  </View>

                  <Text className="text-slate-400 font-bold text-xs mb-2">Bin / Rack / Shelf Code</Text>
                  <View className="flex-row items-center bg-slate-900 border border-slate-800 rounded-xl px-4 py-1">
                    <MapPin color="#64748b" size={16} className="mr-2" />
                    <TextInput
                      value={locationCode}
                      onChangeText={setLocationCode}
                      placeholder="e.g. WH1-R1-S2-B4"
                      placeholderTextColor="#64748b"
                      className="flex-1 text-white py-3 text-base"
                    />
                    <TouchableOpacity
                      onPress={startLocationScan}
                      className="p-2 bg-slate-800 rounded-lg active:scale-95 ml-2"
                    >
                      <Camera color="#0ea5e9" size={18} />
                    </TouchableOpacity>
                  </View>

                  {searchLocationsQuery.isFetching && locationCode.length >= 2 && (
                    <ActivityIndicator size="small" color="#0ea5e9" className="mt-2 align-self-start" />
                  )}

                  {resolvedLocation ? (
                    <View className="flex-row items-center bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl mt-3">
                      <Check color="#10b981" size={16} className="mr-2" />
                      <Text className="text-emerald-400 text-xs font-bold">
                        Resolved: {resolvedLocation.label}
                      </Text>
                    </View>
                  ) : (
                    locationCode.length >= 2 && (
                      <View className="flex-row items-center bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl mt-3">
                        <AlertTriangle color="#f59e0b" size={16} className="mr-2" />
                        <Text className="text-amber-400 text-xs font-bold flex-1">
                          Location not resolved. Will auto-generate default bin.
                        </Text>
                      </View>
                    )
                  )}

                  <Text className="text-slate-400 font-bold text-xs mt-4 mb-2">Initial Quantity</Text>
                  <View className="flex-row items-center bg-slate-900 border border-slate-800 rounded-xl px-4">
                    <Package color="#64748b" size={16} />
                    <TextInput
                      value={quantity}
                      onChangeText={setQuantity}
                      placeholder="1"
                      placeholderTextColor="#64748b"
                      keyboardType="numeric"
                      className="flex-1 text-white py-3 ml-2 text-base"
                    />
                  </View>
                </View>
              </View>
            )}

            {/* STEP 10: eBay Policies */}
            {currentStep === 10 && (
              <View>
                <Text className="text-white text-lg font-black mb-2">eBay Business Policies</Text>
                <Text className="text-slate-400 text-sm mb-4">
                  Business policies are pulled automatically from your eBay account.
                </Text>

                {sellingOptionsQuery.isLoading ? (
                  <View className="py-12 justify-center items-center">
                    <ActivityIndicator size="small" color="#0ea5e9" />
                    <Text className="text-slate-500 text-xs mt-2">Fetching policies from eBay...</Text>
                  </View>
                ) : (
                  <View className="space-y-4">
                    {/* Shipping Policy */}
                    <View>
                      <Text className="text-slate-400 font-bold text-xs uppercase tracking-wider mb-2">Shipping Policy</Text>
                      <View className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-1">
                        <TextInput
                          value={shippingPolicies.find((p) => p.policyId === selectedShippingPolicy)?.name || 'Default Shipping Policy'}
                          editable={false}
                          className="text-white py-3 text-sm font-bold"
                        />
                      </View>
                    </View>

                    {/* Return Policy */}
                    <View>
                      <Text className="text-slate-400 font-bold text-xs uppercase tracking-wider mb-2">Return Policy</Text>
                      <View className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-1">
                        <TextInput
                          value={returnPolicies.find((p) => p.policyId === selectedReturnPolicy)?.name || 'Default Return Policy'}
                          editable={false}
                          className="text-white py-3 text-sm font-bold"
                        />
                      </View>
                    </View>

                    {/* Payment Policy */}
                    <View>
                      <Text className="text-slate-400 font-bold text-xs uppercase tracking-wider mb-2">Payment Policy</Text>
                      <View className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-1">
                        <TextInput
                          value={paymentPolicies.find((p) => p.policyId === selectedPaymentPolicy)?.name || 'Default Payment Policy'}
                          editable={false}
                          className="text-white py-3 text-sm font-bold"
                        />
                      </View>
                    </View>

                    {/* Shipping Origin Location / ZIP */}
                    <View>
                      <Text className="text-slate-400 font-bold text-xs uppercase tracking-wider mb-2">eBay Shipping Origin Location</Text>
                      <View className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-1">
                        {inventoryLocations.length > 0 ? (
                          <View className="flex-row items-center justify-between">
                            <TextInput
                              value={inventoryLocations.find((loc) => `${loc.merchantLocationKey}::${loc.postalCode || ""}` === itemLocationZip)?.name || inventoryLocations[0].name}
                              editable={false}
                              className="text-white py-3 text-sm font-bold flex-1"
                            />
                            <Text className="text-sky-400 text-xs font-black bg-sky-500/10 px-2 py-1 rounded">
                              ZIP: {itemLocationZip.split("::")[1] || "None"}
                            </Text>
                          </View>
                        ) : (
                          <TextInput
                            value="No eBay locations found. Please configure on web."
                            editable={false}
                            className="text-amber-400 py-3 text-sm font-bold"
                          />
                        )}
                      </View>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* STEP 11: Description */}
            {currentStep === 11 && (
              <View>
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-white text-lg font-black">Item Description</Text>
                  <TouchableOpacity
                    onPress={handleGenerateDescription}
                    className="flex-row items-center bg-purple-500/10 px-3 py-1.5 rounded-xl border border-purple-500/20"
                  >
                    <Sparkles color="#a855f7" size={14} className="mr-1" />
                    <Text className="text-purple-400 font-bold text-xs">AI Generate HTML</Text>
                  </TouchableOpacity>
                </View>
                <Text className="text-slate-400 text-sm mb-4">
                  Write a comprehensive description. Use the AI Generate tool above to auto-create professional HTML.
                </Text>

                <View className="mb-4">
                  <TextInput
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Enter detailed item descriptions, notes, and condition specifics here..."
                    placeholderTextColor="#64748b"
                    multiline
                    numberOfLines={8}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-white text-base h-48"
                    style={{ textAlignVertical: 'top' }}
                  />
                </View>
              </View>
            )}

            {/* STEP 12: Review */}
            {currentStep === 12 && (
              <View className="space-y-6">
                <Text className="text-white text-lg font-black mb-2">Review Listing Details</Text>
                <Text className="text-slate-400 text-sm mb-4">
                  Double check your details before saving this draft to the database.
                </Text>

                {/* Photo summary */}
                {photos.length > 0 && (
                  <View className="flex-row gap-2 mb-4">
                    {photos.map((uri, idx) => (
                      <Image key={idx} source={{ uri }} className="w-16 h-16 rounded-lg border border-slate-800" />
                    ))}
                  </View>
                )}

                {/* Detail list with inline edit inputs */}
                <View className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 space-y-4">
                  <View className="border-b border-slate-800/60 pb-3">
                    <Text className="text-slate-400 text-xs font-bold uppercase mb-1">Title</Text>
                    <TextInput
                      value={title}
                      onChangeText={setTitle}
                      maxLength={80}
                      placeholder="Product Title"
                      placeholderTextColor="#64748b"
                      className="text-white text-sm font-bold bg-slate-900/60 border border-slate-800/50 rounded-lg px-3 py-2"
                    />
                  </View>

                  <View className="flex-row gap-4 border-b border-slate-800/60 pb-3">
                    <View className="flex-1">
                      <Text className="text-slate-400 text-xs font-bold uppercase mb-1">Price ($)</Text>
                      <TextInput
                        value={price}
                        onChangeText={setPrice}
                        keyboardType="numeric"
                        placeholder="0.00"
                        placeholderTextColor="#64748b"
                        className="text-emerald-400 text-sm font-black bg-slate-900/60 border border-slate-800/50 rounded-lg px-3 py-2"
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="text-slate-400 text-xs font-bold uppercase mb-1">Quantity</Text>
                      <TextInput
                        value={quantity}
                        onChangeText={setQuantity}
                        keyboardType="numeric"
                        placeholder="1"
                        placeholderTextColor="#64748b"
                        className="text-white text-sm font-bold bg-slate-900/60 border border-slate-800/50 rounded-lg px-3 py-2"
                      />
                    </View>
                  </View>

                  <View className="border-b border-slate-800/60 pb-3">
                    <Text className="text-slate-400 text-xs font-bold uppercase mb-1">Description</Text>
                    <TextInput
                      value={description}
                      onChangeText={setDescription}
                      multiline
                      placeholder="Product Description"
                      placeholderTextColor="#64748b"
                      className="text-slate-300 text-xs bg-slate-900/60 border border-slate-800/50 rounded-lg px-3 py-2 max-h-24"
                      style={{ textAlignVertical: 'top' }}
                    />
                  </View>

                  <View className="flex-row justify-between border-b border-slate-800/60 pb-3 items-center">
                    <Text className="text-slate-400 text-xs font-bold uppercase">Category</Text>
                    <Text className="text-white text-sm font-bold flex-1 text-right ml-4" numberOfLines={1}>
                      {categoryName || 'Uncategorized'}
                    </Text>
                  </View>

                  <View className="flex-row justify-between border-b border-slate-800/60 pb-3 items-center">
                    <Text className="text-slate-400 text-xs font-bold uppercase">Condition</Text>
                    <Text className="text-white text-sm font-bold uppercase">{condition.replace('_', ' ')}</Text>
                  </View>

                  <View className="flex-row justify-between border-b border-slate-800/60 pb-3 items-center">
                    <Text className="text-slate-400 text-xs font-bold uppercase">Location</Text>
                    <Text className="text-sky-400 text-sm font-bold">
                      {resolvedLocation ? resolvedLocation.label : locationCode || 'Unresolved'}
                    </Text>
                  </View>

                  <View className="flex-row justify-between pb-1 items-center">
                    <Text className="text-slate-400 text-xs font-bold uppercase">Specifics Count</Text>
                    <Text className="text-white text-sm font-bold">{specifics.filter((s) => s.value).length} aspects</Text>
                  </View>
                </View>

                {/* Final Save Action */}
                <TouchableOpacity
                  onPress={handleSaveDraft}
                  disabled={loading}
                  className="bg-emerald-600 p-4 rounded-xl items-center active:scale-95 flex-row justify-center mt-6"
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#ffffff" className="mr-2" />
                  ) : (
                    <Check color="#ffffff" size={20} className="mr-2" />
                  )}
                  <Text className="text-white font-black text-base">Save Listing Draft</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* FOOTER NAVIGATION BUTTONS (Except for Start Step) */}
            {currentStep > 1 && (
              <View className="flex-row gap-4 mt-8 border-t border-slate-800/60 pt-6">
                <TouchableOpacity
                  onPress={handlePrevStep}
                  className="flex-1 bg-slate-900 border border-slate-800 p-4 rounded-xl items-center active:scale-95"
                >
                  <Text className="text-slate-300 font-bold text-sm">Back</Text>
                </TouchableOpacity>

                {currentStep < STEPS.length && (
                  <TouchableOpacity
                    onPress={handleNextStep}
                    className={`flex-1 p-4 rounded-xl items-center flex-row justify-center active:scale-95 ${
                      canGoNext() ? 'bg-sky-600' : 'bg-slate-800 opacity-50'
                    }`}
                  >
                    <Text className="text-white font-bold text-sm mr-2">Next</Text>
                    <ArrowRight color="#ffffff" size={16} />
                  </TouchableOpacity>
                )}
              </View>
            )}

          </ScrollView>
        </View>
      )}

      {/* Location Scanner Fullscreen Overlay */}
      {isScanningLocation && (
        <View className="absolute inset-0 bg-black z-50 justify-center items-center">
          <View className="absolute top-12 left-4 right-4 flex-row justify-between items-center z-10">
            <Text className="text-white text-lg font-black">Scan Location QR/Barcode</Text>
            <TouchableOpacity
              onPress={() => setIsScanningLocation(false)}
              className="p-3 bg-slate-900/90 rounded-full border border-slate-800"
            >
              <X color="#ffffff" size={24} />
            </TouchableOpacity>
          </View>
          <CameraView
            onBarcodeScanned={handleLocationScanned}
            className="w-full h-full justify-center items-center"
            facing="back"
          >
            <View className="w-64 h-64 border-2 border-emerald-500 rounded-2xl justify-center items-center">
              <View className="absolute inset-0 border-2 border-dashed border-emerald-400/50 rounded-2xl" />
              <Text className="text-emerald-400 font-bold bg-black/75 px-3 py-1.5 rounded-lg text-xs text-center">
                Align Location QR or Barcode
              </Text>
            </View>
          </CameraView>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
