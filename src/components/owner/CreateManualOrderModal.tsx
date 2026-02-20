import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { Plus, X, Search, User, MapPin, CreditCard, Truck, Store } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { api } from '../../lib/api';

interface Product {
  id: string;
  name: string;
  base_price_cents: number;
  description?: string;
}

interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: any;
}

interface OrderItem {
  product_id: string;
  name: string;
  price_cents: number;
  quantity: number;
}

interface CreateManualOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderCreated: (order: any) => void;
}

export const CreateManualOrderModal: React.FC<CreateManualOrderModalProps> = ({
  isOpen,
  onClose,
  onOrderCreated,
}) => {
  const { activeWorkspace } = useWorkspace();
  const [step, setStep] = useState<'customer' | 'items' | 'fulfillment' | 'payment'>('customer');
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showProductModal, setShowProductModal] = useState(false);
  
  // Form state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [fulfillmentType, setFulfillmentType] = useState<'pickup' | 'delivery'>('pickup');
  const [deliveryAddress, setDeliveryAddress] = useState({
    street: '',
    city: '',
    region: '',
    postal_code: '',
    country: 'CA',
    instructions: '',
  });
  const [paymentMethod, setPaymentMethod] = useState<'cash_on_pickup' | 'cash_on_delivery' | 'card'>('cash_on_pickup');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen && activeWorkspace) {
      fetchProducts();
      fetchCustomers();
    }
  }, [isOpen, activeWorkspace]);

  const fetchProducts = async () => {
    if (!activeWorkspace?.id) {
      console.error('No active workspace for fetching products');
      return;
    }
    
    try {
      console.log('Fetching products via API...');
      
      // Use the same API that works in MenuManagement
      const items = await api.ownerListMenuItems();
      
      console.log('Fetched menu items:', items?.length || 0, items);
      
      // Transform menu_items to products format
      const transformedProducts = items.map((item: any) => ({
        id: item.id,
        name: item.name_fr || item.name_en || item.name || 'Unnamed Product',
        base_price_cents: item.price_cents || 0,
        description: item.description_fr || item.description_en || item.description || '',
        is_active: item.is_active !== false
      }));
      
      setProducts(transformedProducts);
    } catch (err: any) {
      console.error('Exception fetching products:', err);
      console.error('Error details:', err.message);
    }
  };

  const fetchCustomers = async () => {
    const { data } = await supabase
      .from('customers')
      .select('id, name, email, phone, address')
      .eq('workspace_id', activeWorkspace?.id)
      .order('name')
      .limit(50);
    
    if (data) setCustomers(data);
  };

  const addItem = (product: Product) => {
    const existing = orderItems.find(item => item.product_id === product.id);
    if (existing) {
      setOrderItems(orderItems.map(item => 
        item.product_id === product.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setOrderItems([...orderItems, {
        product_id: product.id,
        name: product.name,
        price_cents: product.base_price_cents,
        quantity: 1,
      }]);
    }
  };

  const removeItem = (productId: string) => {
    setOrderItems(orderItems.filter(item => item.product_id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId);
    } else {
      setOrderItems(orderItems.map(item => 
        item.product_id === productId 
          ? { ...item, quantity }
          : item
      ));
    }
  };

  const calculateTotals = () => {
    const subtotal = orderItems.reduce((sum, item) => sum + (item.price_cents * item.quantity), 0);
    const tax = Math.round(subtotal * 0.15); // 15% tax
    const deliveryFee = fulfillmentType === 'delivery' ? 599 : 0; // $5.99
    const serviceFee = Math.round(subtotal * 0.05); // 5% service fee
    const total = subtotal + tax + deliveryFee + serviceFee;
    
    return {
      subtotal_cents: subtotal,
      tax_cents: tax,
      delivery_fee_cents: deliveryFee,
      service_fee_cents: serviceFee,
      total_cents: total,
    };
  };

  const selectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setNewCustomerName(customer.name);
    setNewCustomerEmail(customer.email || '');
    setNewCustomerPhone(customer.phone || '');
    if (customer.address) {
      const addr = typeof customer.address === 'string' ? JSON.parse(customer.address) : customer.address;
      setDeliveryAddress(prev => ({
        ...prev,
        street: addr.street || addr.address || '',
        city: addr.city || '',
        region: addr.region || addr.province || '',
        postal_code: addr.postal_code || addr.postalCode || '',
      }));
    }
    setStep('items');
  };

  const useNewCustomer = () => {
    setSelectedCustomer(null);
    setStep('items');
  };

  const createOrder = async () => {
    setLoading(true);
    
    try {
      const totals = calculateTotals();
      const customerName = selectedCustomer?.name || newCustomerName;
      
      if (!customerName || orderItems.length === 0) {
        alert('Please fill in all required fields');
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create_manual_order`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            customer_id: selectedCustomer?.id,
            customer_name: customerName,
            customer_email: newCustomerEmail || null,
            customer_phone: newCustomerPhone || null,
            items: orderItems.map(item => ({
              product_id: item.product_id,
              quantity: item.quantity,
            })),
            fulfillment_type: fulfillmentType,
            delivery_address: fulfillmentType === 'delivery' ? deliveryAddress : null,
            notes: notes || null,
            payment_method: paymentMethod,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create order');
      }

      const result = await response.json();
      onOrderCreated(result.order);
      onClose();
      resetForm();
    } catch (error: any) {
      alert('Error creating order: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStep('customer');
    setSelectedCustomer(null);
    setNewCustomerName('');
    setNewCustomerEmail('');
    setNewCustomerPhone('');
    setOrderItems([]);
    setFulfillmentType('pickup');
    setDeliveryAddress({
      street: '',
      city: '',
      region: '',
      postal_code: '',
      country: 'CA',
      instructions: '',
    });
    setPaymentMethod('cash_on_pickup');
    setNotes('');
    setShowProductModal(false);
  };

  const [customerSearchQuery, setCustomerSearchQuery] = useState('');

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
    c.email?.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
    c.phone?.includes(customerSearchQuery)
  );

  const totals = calculateTotals();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">Create Manual Order</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center gap-2 px-6 py-4 bg-gray-50">
          {['customer', 'items', 'fulfillment', 'payment'].map((s, index) => (
            <React.Fragment key={s}>
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                step === s ? 'bg-pink-500 text-white' :
                ['customer', 'items', 'fulfillment', 'payment'].indexOf(step) > index ? 'bg-green-500 text-white' :
                'bg-gray-200 text-gray-600'
              }`}>
                {s === 'customer' && <User className="w-4 h-4" />}
                {s === 'items' && <Store className="w-4 h-4" />}
                {s === 'fulfillment' && <Truck className="w-4 h-4" />}
                {s === 'payment' && <CreditCard className="w-4 h-4" />}
                <span className="capitalize">{s}</span>
              </div>
              {index < 3 && <div className="w-8 h-px bg-gray-300" />}
            </React.Fragment>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Customer Selection */}
          {step === 'customer' && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search existing customers..."
                  value={customerSearchQuery}
                  onChange={(e) => setCustomerSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                />
              </div>

              {/* Existing Customers */}
              {customerSearchQuery && filteredCustomers.length > 0 && (
                <div className="border rounded-xl divide-y max-h-48 overflow-y-auto">
                  {filteredCustomers.map(customer => (
                    <button
                      key={customer.id}
                      onClick={() => selectCustomer(customer)}
                      className="w-full p-4 text-left hover:bg-gray-50 transition-colors flex items-center gap-3"
                    >
                      <div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-pink-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{customer.name}</p>
                        <p className="text-sm text-gray-500">
                          {customer.email} • {customer.phone}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* New Customer Form */}
              <div className="border rounded-xl p-4 space-y-4">
                <h3 className="font-medium text-gray-700 flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  New Customer
                </h3>
                <input
                  type="text"
                  placeholder="Customer Name *"
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-pink-500"
                />
                <input
                  type="email"
                  placeholder="Email (optional)"
                  value={newCustomerEmail}
                  onChange={(e) => setNewCustomerEmail(e.target.value)}
                  className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-pink-500"
                />
                <input
                  type="tel"
                  placeholder="Phone (optional)"
                  value={newCustomerPhone}
                  onChange={(e) => setNewCustomerPhone(e.target.value)}
                  className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-pink-500"
                />
                <button
                  onClick={useNewCustomer}
                  disabled={!newCustomerName}
                  className="w-full py-3 bg-pink-500 text-white rounded-xl font-medium hover:bg-pink-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue with New Customer
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Items Selection */}
          {step === 'items' && (
            <div className="space-y-4">
              {/* Browse Products Button */}
              <button
                onClick={() => setShowProductModal(true)}
                className="w-full py-4 border-2 border-dashed border-pink-300 rounded-xl flex items-center justify-center gap-2 text-pink-600 hover:bg-pink-50 transition-colors"
              >
                <Plus className="w-5 h-5" />
                <span className="font-medium">Browse Products</span>
              </button>

              {/* Selected Items */}
              {orderItems.length > 0 && (
                <div className="border rounded-xl p-4 space-y-3">
                  <h3 className="font-medium text-gray-700">Order Items</h3>
                  {orderItems.map(item => (
                    <div key={item.product_id} className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-gray-500">${(item.price_cents / 100).toFixed(2)} each</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                          className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                        >
                          -
                        </button>
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                          className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Order Summary */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>${(totals.subtotal_cents / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Tax (15%)</span>
                  <span>${(totals.tax_cents / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Service Fee (5%)</span>
                  <span>${(totals.service_fee_cents / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg pt-2 border-t">
                  <span>Total</span>
                  <span>${(totals.total_cents / 100).toFixed(2)}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('customer')}
                  className="flex-1 py-3 border border-gray-300 rounded-xl font-medium hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep('fulfillment')}
                  disabled={orderItems.length === 0}
                  className="flex-1 py-3 bg-pink-500 text-white rounded-xl font-medium hover:bg-pink-600 disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Fulfillment */}
          {step === 'fulfillment' && (
            <div className="space-y-4">
              <div className="flex gap-4">
                <button
                  onClick={() => setFulfillmentType('pickup')}
                  className={`flex-1 p-4 border-2 rounded-xl flex flex-col items-center gap-2 transition-colors ${
                    fulfillmentType === 'pickup' ? 'border-pink-500 bg-pink-50' : 'border-gray-200'
                  }`}
                >
                  <Store className={`w-6 h-6 ${fulfillmentType === 'pickup' ? 'text-pink-500' : 'text-gray-400'}`} />
                  <span className="font-medium">Pickup</span>
                </button>
                <button
                  onClick={() => setFulfillmentType('delivery')}
                  className={`flex-1 p-4 border-2 rounded-xl flex flex-col items-center gap-2 transition-colors ${
                    fulfillmentType === 'delivery' ? 'border-pink-500 bg-pink-50' : 'border-gray-200'
                  }`}
                >
                  <Truck className={`w-6 h-6 ${fulfillmentType === 'delivery' ? 'text-pink-500' : 'text-gray-400'}`} />
                  <span className="font-medium">Delivery</span>
                </button>
              </div>

              {fulfillmentType === 'delivery' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-gray-700">
                    <MapPin className="w-5 h-5" />
                    <span className="font-medium">Delivery Address</span>
                  </div>
                  <input
                    type="text"
                    placeholder="Street Address *"
                    value={deliveryAddress.street}
                    onChange={(e) => setDeliveryAddress({ ...deliveryAddress, street: e.target.value })}
                    className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-pink-500"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="City *"
                      value={deliveryAddress.city}
                      onChange={(e) => setDeliveryAddress({ ...deliveryAddress, city: e.target.value })}
                      className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-pink-500"
                    />
                    <input
                      type="text"
                      placeholder="Province/Region *"
                      value={deliveryAddress.region}
                      onChange={(e) => setDeliveryAddress({ ...deliveryAddress, region: e.target.value })}
                      className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-pink-500"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Postal Code *"
                    value={deliveryAddress.postal_code}
                    onChange={(e) => setDeliveryAddress({ ...deliveryAddress, postal_code: e.target.value })}
                    className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-pink-500"
                  />
                  <input
                    type="text"
                    placeholder="Delivery Instructions (optional)"
                    value={deliveryAddress.instructions}
                    onChange={(e) => setDeliveryAddress({ ...deliveryAddress, instructions: e.target.value })}
                    className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-pink-500"
                  />
                </div>
              )}

              <textarea
                placeholder="Order notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-pink-500 h-24 resize-none"
              />

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('items')}
                  className="flex-1 py-3 border border-gray-300 rounded-xl font-medium hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep('payment')}
                  disabled={fulfillmentType === 'delivery' && (!deliveryAddress.street || !deliveryAddress.city)}
                  className="flex-1 py-3 bg-pink-500 text-white rounded-xl font-medium hover:bg-pink-600 disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Payment */}
          {step === 'payment' && (
            <div className="space-y-4">
              <div className="space-y-3">
                <label className="flex items-center gap-3 p-4 border-2 border-pink-500 bg-pink-50 rounded-xl cursor-pointer">
                  <input
                    type="radio"
                    name="payment"
                    value="cash_on_pickup"
                    checked={paymentMethod === 'cash_on_pickup'}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-4 h-4 text-pink-500"
                  />
                  <div className="flex-1">
                    <p className="font-medium">Cash on {fulfillmentType === 'pickup' ? 'Pickup' : 'Delivery'}</p>
                    <p className="text-sm text-gray-500">Customer pays when they receive the order</p>
                  </div>
                </label>

                {fulfillmentType === 'pickup' && (
                  <label className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-xl cursor-pointer hover:border-pink-300">
                    <input
                      type="radio"
                      name="payment"
                      value="card"
                      checked={paymentMethod === 'card'}
                      onChange={(e) => setPaymentMethod(e.target.value as any)}
                      className="w-4 h-4 text-pink-500"
                    />
                    <div className="flex-1">
                      <p className="font-medium">Pay by Card</p>
                      <p className="text-sm text-gray-500">Send payment link to customer</p>
                    </div>
                  </label>
                )}
              </div>

              {/* Final Summary */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <h3 className="font-medium text-gray-900">Order Summary</h3>
                <div className="flex justify-between text-sm">
                  <span>Customer</span>
                  <span className="font-medium">{newCustomerName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Items</span>
                  <span className="font-medium">{orderItems.reduce((sum, i) => sum + i.quantity, 0)} items</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Fulfillment</span>
                  <span className="font-medium capitalize">{fulfillmentType}</span>
                </div>
                <div className="flex justify-between font-bold text-lg pt-2 border-t">
                  <span>Total</span>
                  <span>${(totals.total_cents / 100).toFixed(2)}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('fulfillment')}
                  className="flex-1 py-3 border border-gray-300 rounded-xl font-medium hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  onClick={createOrder}
                  disabled={loading}
                  className="flex-1 py-3 bg-pink-500 text-white rounded-xl font-medium hover:bg-pink-600 disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create Order'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Product Selector Modal */}
      {showProductModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
            onClick={() => setShowProductModal(false)} 
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-xl font-bold text-gray-900">Select Products</h3>
              <button 
                onClick={() => setShowProductModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {products.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p>No products available</p>
                  <p className="text-sm mt-2">Make sure you have products in your workspace</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {products.map(product => {
                    const existingItem = orderItems.find(item => item.product_id === product.id);
                    const quantity = existingItem?.quantity || 0;
                    
                    return (
                      <div 
                        key={product.id}
                        className="border rounded-xl p-4 hover:border-pink-300 transition-colors"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="font-medium text-gray-900">{product.name}</h4>
                            <p className="text-sm text-gray-500">
                              ${(product.base_price_cents / 100).toFixed(2)}
                            </p>
                          </div>
                        </div>
                        
                        {product.description && (
                          <p className="text-xs text-gray-400 mb-3 line-clamp-2">
                            {product.description}
                          </p>
                        )}
                        
                        <div className="flex items-center justify-between mt-3">
                          {quantity > 0 ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => updateQuantity(product.id, quantity - 1)}
                                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                              >
                                -
                              </button>
                              <span className="w-8 text-center font-medium">{quantity}</span>
                              <button
                                onClick={() => updateQuantity(product.id, quantity + 1)}
                                className="w-8 h-8 rounded-full bg-pink-100 hover:bg-pink-200 text-pink-600 flex items-center justify-center"
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => addItem(product)}
                              className="px-4 py-2 bg-pink-500 text-white rounded-lg text-sm font-medium hover:bg-pink-600"
                            >
                              Add to Order
                            </button>
                          )}
                          
                          {quantity > 0 && (
                            <span className="text-sm text-pink-600 font-medium">
                              ${((product.base_price_cents * quantity) / 100).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t p-6 flex justify-between items-center">
              <div>
                <span className="text-sm text-gray-500">
                  {orderItems.reduce((sum, i) => sum + i.quantity, 0)} items selected
                </span>
                <p className="font-medium">
                  Total: ${(totals.total_cents / 100).toFixed(2)}
                </p>
              </div>
              <button
                onClick={() => setShowProductModal(false)}
                className="px-6 py-3 bg-pink-500 text-white rounded-xl font-medium hover:bg-pink-600"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
