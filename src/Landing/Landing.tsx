import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, 
  Instagram, 
  Smartphone, 
  DollarSign, 
  Users, 
  CheckCircle2, 
  ChevronRight, 
  Menu, 
  X,
  Zap,
  ShoppingBag,
  Heart,
  Star,
  ShoppingCart,
  Plus,
  BadgeCheck,
  Award,
  Truck,
  MapPin,
  ShieldCheck,
  Globe,
  Navigation,
  MessageSquare,
  CreditCard,
  Store,
  Utensils,
  TrendingUp
} from 'lucide-react';

interface Testimonial {
  name: string;
  role: string;
  avatar: string;
  quote: string;
  location: string;
  joined: string;
}

interface Customer {
  name: string;
  category: string;
  location: string;
  image: string;
}

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <nav className="fixed top-0 w-full z-50 glass">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-[#FF4D00] p-1.5 rounded-lg">
            <ShoppingBag className="w-6 h-6 text-white" />
          </div>
          <div className="flex flex-col -space-y-1">
            <span className="text-2xl font-black tracking-tighter">flavrr</span>
            <span className="text-[9px] font-black text-gray-400 tracking-widest uppercase">Proudly 🇨🇦</span>
          </div>
        </div>
        
        <div className="hidden md:flex items-center gap-8 font-medium">
          <a href="#how-it-works" className="hover:text-[#FF4D00] transition-colors">How it works</a>
          <a href="#delivery" className="hover:text-[#FF4D00] transition-colors">Delivery Fleet</a>
          <a href="#reviews" className="hover:text-[#FF4D00] transition-colors">Reviews</a>
          <button 
            onClick={() => window.location.href = '/login'}
            className="bg-[#1A1A1A] text-white px-6 py-2.5 rounded-full hover:bg-black transition-all transform hover:scale-105"
          >
            Login
          </button>
        </div>

        <button className="md:hidden" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <X /> : <Menu />}
        </button>
      </div>

      {isOpen && (
        <div className="md:hidden absolute top-20 left-0 w-full bg-white border-b px-6 py-8 flex flex-col gap-6 shadow-xl animate-fade-in-down">
          <a href="#how-it-works" onClick={() => setIsOpen(false)} className="text-lg font-semibold">How it works</a>
          <a href="#delivery" onClick={() => setIsOpen(false)} className="text-lg font-semibold">Delivery Fleet</a>
          <a href="#reviews" onClick={() => setIsOpen(false)} className="text-lg font-semibold">Reviews</a>
          <button 
            onClick={() => window.location.href = '/signup'}
            className="bg-[#FF4D00] text-white px-6 py-3 rounded-xl font-bold"
          >
            Create my free site
          </button>
        </div>
      )}
    </nav>
  );
};

const InteractivePhone = () => {
  const [activeCategory, setActiveCategory] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveCategory((prev) => (prev + 1) % 3);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-[300px] h-[620px] bg-black rounded-[3.5rem] border-[10px] border-gray-900 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] relative overflow-hidden transform md:rotate-2 hover:rotate-0 transition-all duration-700">
      <div className="absolute inset-0 bg-white flex flex-col">
        <div className="h-8 flex justify-between items-center px-6 pt-2 shrink-0">
           <span className="text-[10px] font-bold">9:41</span>
           <div className="flex gap-1 items-center">
              <div className="w-1 h-1 bg-black/20 rounded-full"></div>
              <div className="w-3 h-1 bg-black/20 rounded-full"></div>
           </div>
        </div>

        <div className="flex flex-col h-full">
          <div className="relative h-28 shrink-0 overflow-hidden">
            <img src="https://images.unsplash.com/photo-1544124499-58912cbddaad?q=80&w=600&auto=format&fit=crop" className="w-full h-full object-cover" alt="Banner" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
            <div className="absolute bottom-2 left-4 bg-green-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">Open Now</div>
          </div>

          <div className="px-4 -mt-10 relative z-10">
            <div className="w-20 h-20 bg-white rounded-3xl shadow-xl border-4 border-white overflow-hidden mx-auto mb-2 relative">
               <img src="https://images.unsplash.com/photo-1577214459173-9c2151b066f5?q=80&w=200&h=200&auto=format&fit=crop" alt="Avatar" className="w-full h-full object-cover" />
            </div>
            <div className="flex items-center justify-center gap-1">
               <h3 className="font-black text-sm">Nonna's Pasta Shop</h3>
               <BadgeCheck className="w-3.5 h-3.5 text-blue-500" />
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto px-4 mt-4 no-scrollbar">
            {['Pasta', 'Dolci', 'Wine'].map((cat, i) => (
              <div key={cat} className={`px-4 py-1.5 rounded-full text-[10px] font-bold transition-all ${activeCategory === i ? 'bg-[#FF4D00] text-white shadow-lg shadow-orange-100' : 'bg-gray-100 text-gray-400'}`}>
                {cat}
              </div>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto px-4 mt-4 space-y-3 pb-20 no-scrollbar">
            {[
              { name: 'Truffle Ravioli', price: '$24.00', img: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?q=80&w=200' },
              { name: 'Classic Carbonara', price: '$19.00', img: 'https://images.unsplash.com/photo-1546548970-71785318a17b?q=80&w=200' },
              { name: 'Tiramisu', price: '$12.00', img: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?q=80&w=200' },
              { name: 'Focaccia Bread', price: '$8.00', img: 'https://images.unsplash.com/photo-1573140401552-3fab0b24306f?q=80&w=200' }
            ].map((item, i) => (
              <div key={i} className="bg-gray-50 rounded-[1.5rem] p-3 flex gap-3 shadow-sm hover:scale-[1.02] transition-transform">
                <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0">
                  <img src={item.img} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <h4 className="text-[10px] font-bold">{item.name}</h4>
                    <span className="text-[10px] font-black text-[#FF4D00]">{item.price}</span>
                  </div>
                  <div className="mt-2 w-6 h-6 rounded-lg bg-white shadow-sm flex items-center justify-center text-gray-300">
                    <Plus className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="absolute bottom-6 left-4 right-4 z-20">
            <div className="bg-[#1A1A1A] text-white p-4 rounded-3xl flex items-center justify-between shadow-2xl border border-white/10 animate-pulse-slow">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <ShoppingCart className="w-4 h-4 text-[#FF4D00]" />
                  <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-white text-[#1A1A1A] text-[6px] font-black rounded-full flex items-center justify-center shadow-md">2</div>
                </div>
                <span className="text-[11px] font-bold">Checkout ($43.00)</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-500" />
            </div>
          </div>
        </div>
      </div>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-gray-900 rounded-b-[1.5rem] z-50"></div>
    </div>
  );
};

const NotificationCluster = () => {
  return (
    <div className="absolute inset-0 pointer-events-none z-40 overflow-visible hidden md:block">
      <div className="absolute top-8 right-0 md:right-6 animate-float-ambient">
        <div className="max-w-[200px] bg-white/85 backdrop-blur-xl border border-black/5 rounded-[1.75rem] px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.08)] flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-white text-gray-700 border border-black/5 flex items-center justify-center">
            <Truck className="w-4 h-4 text-gray-700" />
          </div>
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-gray-700">Order delivered</p>
            <p className="text-[10px] uppercase tracking-[0.25em] text-gray-500">15 min avg</p>
          </div>
        </div>
      </div>

      <div className="absolute bottom-6 left-0 md:left-4 animate-float-ambient-delayed">
        <div className="max-w-[180px] bg-white/85 backdrop-blur-xl border border-black/5 rounded-[1.5rem] px-4 py-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.08)] flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-[#FFF4EC] text-[#FF4D00] flex items-center justify-center border border-[#FF4D00]/20">
            <Zap className="w-4 h-4" />
          </div>
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-gray-700">$324 saved</p>
            <p className="text-[10px] uppercase tracking-[0.25em] text-gray-500">0% commission</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const Hero = () => {
  return (
    <section className="relative pt-32 pb-20 px-6 overflow-hidden">
      <div className="blob top-0 left-1/2 -translate-x-1/2"></div>
      <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-20 items-center">
        <div className="space-y-8 text-center md:text-left">
          <div className="flex flex-wrap gap-3 justify-center md:justify-start">
            <div className="inline-flex items-center gap-2 bg-[#FFF0E6] text-[#FF4D00] px-4 py-2 rounded-full text-sm font-bold border border-orange-100 shadow-sm">
              <Zap className="w-4 h-4 fill-current" />
              <span>0% MARKETPLACE TAX</span>
            </div>
            <div className="inline-flex items-center gap-2 bg-gray-100 text-gray-600 px-4 py-2 rounded-full text-sm font-bold shadow-sm">
              <span>🇨🇦 BUILT IN CANADA</span>
            </div>
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.05]">
            The <span className="gradient-text">Link in Bio</span> That Actually Pays.
          </h1>
          <p className="text-xl text-gray-500 font-medium max-w-lg mx-auto md:mx-0 leading-relaxed">
            Own your customer data. Keep your margins. Let our <span className="text-[#1A1A1A] font-bold underline decoration-[#FF4D00] decoration-4 underline-offset-4">integrated fleet</span> handle the logistics automatically.
          </p>
          <div className="flex flex-col sm:grow md:flex-row gap-4 justify-center md:justify-start">
            <button 
              onClick={() => window.location.href = '/demo-login'}
              className="bg-[#FF4D00] text-white px-10 py-5 rounded-[2rem] text-lg font-bold shadow-[0_20px_40px_rgba(255,77,0,0.3)] hover:shadow-[0_25px_50px_rgba(255,77,0,0.4)] hover:-translate-y-1 transition-all"
            >
              Start Selling Direct
            </button>
            <button className="bg-white text-[#1A1A1A] border-2 border-gray-100 px-10 py-5 rounded-[2rem] text-lg font-bold hover:bg-gray-50 transition-all flex items-center justify-center gap-2 shadow-sm">
              View Showcase <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          </div>
          <div className="flex items-center justify-center md:justify-start gap-8 pt-4">
             <div className="text-center">
                <p className="text-2xl font-black text-[#1A1A1A]">5,000+</p>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Sellers</p>
             </div>
             <div className="w-px h-8 bg-gray-100"></div>
             <div className="text-center">
                <p className="text-2xl font-black text-[#1A1A1A]">$12M+</p>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Paid Out</p>
             </div>
             <div className="w-px h-8 bg-gray-100"></div>
             <div className="text-center">
                <p className="text-2xl font-black text-[#FF4D00]">0%</p>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Commission</p>
             </div>
          </div>
        </div>

        <div className="relative flex justify-center py-10">
          <NotificationCluster />
          <InteractivePhone />
        </div>
      </div>
    </section>
  );
};

const CustomerShowcase = () => {
  const row1: Customer[] = [
    { name: "Nonna's Pasta", category: "Creator", location: "Vancouver, BC", image: "https://images.unsplash.com/photo-1577214459173-9c2151b066f5?q=80&w=100" },
    { name: "The Baker's Den", category: "Bakery", location: "Toronto, ON", image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?q=80&w=100" },
    { name: "Koji Sushi", category: "Pop-up Shop", location: "Montreal, QC", image: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?q=80&w=100" },
    { name: "Spice Queen", category: "Food Creator", location: "Calgary, AB", image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=100" },
    { name: "Wild Honey", category: "Direct Seller", location: "Ottawa, ON", image: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?q=80&w=100" },
  ];

  const row2: Customer[] = [
    { name: "Urban Greens", category: "Pop-up", location: "Halifax, NS", image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=100" },
    { name: "Dough Joy", category: "Bakery", location: "Winnipeg, MB", image: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?q=80&w=100" },
    { name: "Craft Coffee", category: "Roastery", location: "Edmonton, AB", image: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?q=80&w=100" },
    { name: "Seoul Kitchen", category: "Restaurant", location: "Vancouver, BC", image: "https://images.unsplash.com/photo-1541745537411-b8046dc6d66c?q=80&w=100" },
    { name: "Artisan Tacos", category: "Food Truck", location: "Hamilton, ON", image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?q=80&w=100" },
  ];

  const BrandCard = ({ c }: { c: Customer; key?: React.Key }) => (
    <div className="flex-none w-[280px] bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 flex items-center gap-4 hover:border-[#FF4D00] hover:scale-[1.02] transition-all cursor-default group">
      <div className="w-14 h-14 rounded-2xl overflow-hidden shadow-md border-2 border-white shrink-0">
        <img src={c.image} alt={c.name} className="w-full h-full object-cover" />
      </div>
      <div className="overflow-hidden">
        <div className="flex items-center gap-1.5 mb-1">
          <h4 className="font-black text-sm truncate">{c.name}</h4>
          <BadgeCheck className="w-3.5 h-3.5 text-blue-500 shrink-0" />
        </div>
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
           <span className="text-[#FF4D00]/70">{c.category}</span>
           <span className="w-1 h-1 bg-gray-200 rounded-full"></span>
           <span className="truncate">{c.location}</span>
        </div>
      </div>
    </div>
  );

  return (
    <section className="py-24 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 mb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-orange-50 text-[#FF4D00] px-4 py-1.5 rounded-full text-sm font-bold mb-6 border border-orange-100">
          <Store className="w-4 h-4" />
          <span>JOIN THE COMMUNITY</span>
        </div>
        <h2 className="text-4xl md:text-5xl font-extrabold mb-4 leading-tight">Powering the next generation <br className="hidden md:block" /> of food sellers.</h2>
        <p className="text-xl text-gray-400 font-medium max-w-2xl mx-auto">From Instagram creators to neighborhood favorites, thousands of Canadians are selling direct with Flavrr.</p>
      </div>

      <div className="space-y-6">
        <div className="relative">
          <div className="flex animate-marquee-l gap-6 py-2">
            {[...row1, ...row1, ...row1].map((c, idx) => (
              <BrandCard key={idx} c={c} />
            ))}
          </div>
        </div>
        
        <div className="relative">
          <div className="flex animate-marquee-r gap-6 py-2">
            {[...row2, ...row2, ...row2].map((c, idx) => (
              <BrandCard key={idx} c={c} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const DeliverySection = () => {
  return (
    <section id="delivery" className="py-24 bg-[#1A1A1A] text-white overflow-hidden relative">
      <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-20 items-center">
        <div className="space-y-8 relative z-10">
          <div className="inline-flex items-center gap-2 bg-white/10 px-4 py-1.5 rounded-full text-sm font-bold text-[#FF4D00]">
            <Truck className="w-4 h-4" />
            <span>FLEET-AS-A-SERVICE</span>
          </div>
          <h2 className="text-4xl md:text-6xl font-black leading-tight">No drivers?<br/><span className="text-gray-400 underline decoration-[#FF4D00] decoration-4 underline-offset-8">No problem.</span></h2>
          <p className="text-xl text-gray-400 font-medium leading-relaxed">
            Flavrr connects your orders to a massive network of <span className="text-white font-bold">local third-party drivers</span>. You focus on the food, we handle the fleet.
          </p>
          <ul className="space-y-5">
            {[
              "Automated dispatch to 500k+ drivers",
              "Real-time GPS tracking for your fans",
              "Zero logistics management required",
              "Flat-fee delivery, 0% commission"
            ].map((item, i) => (
              <li key={i} className="flex items-center gap-4 text-lg font-bold group">
                <div className="bg-green-500/20 p-1.5 rounded-full group-hover:bg-green-500 transition-colors">
                  <CheckCircle2 className="w-5 h-5 text-green-500 group-hover:text-white" />
                </div>
                {item}
              </li>
            ))}
          </ul>
        </div>
        
        <div className="relative">
          <div className="bg-gradient-to-br from-[#FF4D00] to-[#FF9500] p-1 rounded-[3.5rem] shadow-2xl shadow-orange-500/20">
            <div className="bg-[#1A1A1A] rounded-[3.3rem] p-10 overflow-hidden relative">
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-[#FF4D00]/20 rounded-2xl flex items-center justify-center">
                      <MapPin className="text-[#FF4D00] w-7 h-7" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-black tracking-widest uppercase">Live Fleet Status</p>
                      <h4 className="font-bold text-2xl">Finding Driver...</h4>
                    </div>
                  </div>
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-ping"></div>
                </div>
                
                <div className="h-48 bg-gray-800/30 rounded-3xl relative border border-white/5 flex items-center justify-center">
                   <div className="absolute top-1/2 left-10 right-10 h-0.5 bg-gray-700/50"></div>
                   <div className="absolute top-1/2 left-10 h-0.5 bg-[#FF4D00] w-[60%] animate-pulse"></div>
                   
                   <div className="flex justify-between w-full px-10 relative z-10">
                      <div className="text-center">
                        <div className="w-12 h-12 bg-white rounded-2xl shadow-lg flex items-center justify-center mb-2">
                           <ShoppingBag className="text-black w-6 h-6" />
                        </div>
                        <p className="text-[10px] font-black uppercase text-gray-500">Pick-up</p>
                      </div>
                      <div className="text-center transform translate-y-[-20px] animate-bounce-slow">
                        <div className="w-12 h-12 bg-[#FF4D00] rounded-2xl shadow-xl flex items-center justify-center mb-2">
                           <Truck className="text-white w-6 h-6" />
                        </div>
                        <p className="text-[10px] font-black uppercase text-[#FF4D00]">Fleet Driver</p>
                      </div>
                      <div className="text-center">
                        <div className="w-12 h-12 bg-white/10 rounded-2xl border border-white/20 flex items-center justify-center mb-2">
                           <Heart className="text-gray-500 w-6 h-6" />
                        </div>
                        <p className="text-[10px] font-black uppercase text-gray-500">Customer</p>
                      </div>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 p-5 rounded-[2rem] border border-white/10">
                     <p className="text-[10px] text-gray-500 font-black uppercase mb-1">Service Type</p>
                     <p className="font-bold text-lg">Third-Party Fleet</p>
                  </div>
                  <div className="bg-white/5 p-5 rounded-[2rem] border border-white/10">
                     <p className="text-[10px] text-gray-500 font-black uppercase mb-1">Fee per Order</p>
                     <p className="font-extrabold text-green-500 text-lg">$0.00</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const ReviewsSection = () => {
  const reviews: Testimonial[] = [
    { name: "Maya", role: "Artisan Baker", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=100", quote: "Stopped giving away my profits. Flavrr is a game changer for my weekend drops.", location: "Toronto, ON", joined: "Joined 2024" },
    { name: "Chef Marco", role: "Pizzeria Owner", avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=100", quote: "The delivery integration is seamless. I didn't have to hire anyone or manage schedules.", location: "Montreal, QC", joined: "Joined 2023" },
    { name: "Elena", role: "Vegan Pastry Chef", avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=100", quote: "Finally, a platform that understands Canadian creators. Ownership is the only way to scale.", location: "Vancouver, BC", joined: "Joined 2024" },
    { name: "Julian", role: "Burger Pop-up", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=100", quote: "Setup took 5 minutes. My fans love the tracking experience. It's truly high-end.", location: "Ottawa, ON", joined: "Joined 2024" },
    { name: "Sarah J.", role: "Coffee Roaster", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=100", quote: "Managing direct orders and third-party delivery in one dashboard is a life saver.", location: "Calgary, AB", joined: "Joined 2023" },
  ];

  return (
    <section id="reviews" className="py-24 bg-[#FAFAFA] overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 mb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-600 px-4 py-1.5 rounded-full text-sm font-bold mb-6 border border-blue-100">
          <BadgeCheck className="w-4 h-4 fill-current" />
          <span>VERIFIED SELLERS</span>
        </div>
        <h2 className="text-4xl md:text-5xl font-extrabold mb-4">Trusted by 5,000+ Creators</h2>
        <p className="text-xl text-gray-400 font-medium">Real results, zero marketplace commissions.</p>
      </div>

      <div className="relative">
        <div className="flex animate-marquee-reviews gap-6 py-6">
          {[...reviews, ...reviews].map((r, idx) => (
            <div key={idx} className="flex-none w-[350px] md:w-[400px]">
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 hover:border-[#FF4D00] transition-colors relative group">
                <div className="absolute top-6 right-8 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Award className="w-12 h-12 text-[#FF4D00]" />
                </div>
                <div className="flex items-center gap-4 mb-6">
                  <img src={r.avatar} alt={r.name} className="w-14 h-14 rounded-full border-2 border-white shadow-lg object-cover" />
                  <div>
                    <div className="flex items-center gap-1">
                      <h4 className="font-bold text-lg">{r.name}</h4>
                      <BadgeCheck className="w-4 h-4 text-blue-500" />
                    </div>
                    <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">{r.role}</p>
                  </div>
                </div>
                <div className="flex mb-4">
                  {[1,2,3,4,5].map(s => <Star key={s} className="w-4 h-4 fill-yellow-400 text-yellow-400" />)}
                </div>
                <p className="text-[#1A1A1A] font-medium italic leading-relaxed">"{r.quote}"</p>
                <div className="mt-6 pt-6 border-t border-gray-50 flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  <span>{r.location}</span>
                  <span className="text-[#FF4D00]">{r.joined}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[#FAFAFA] to-transparent z-10 pointer-events-none"></div>
        <div className="absolute inset-y-0 right-0 w-32 bg-gradient-l from-[#FAFAFA] to-transparent z-10 pointer-events-none"></div>
      </div>
    </section>
  );
};

const CTASection = () => {
  return (
    <section className="py-24 px-6 relative overflow-hidden">
      <div className="blob bottom-0 right-0"></div>
      <div className="max-w-4xl mx-auto bg-gradient-to-br from-[#FF4D00] to-[#FF9500] rounded-[3.5rem] p-12 md:p-20 text-center text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-10 opacity-10 rotate-12">
           <svg viewBox="0 0 24 24" fill="currentColor" className="w-32 h-32">
              <path d="M12,2L13.5,6.5L18,7L15,10L16,14.5L12,12.5L8,14.5L9,10L6,7L10.5,6.5L12,2Z" />
           </svg>
        </div>

        <h2 className="text-4xl md:text-6xl font-black mb-8 leading-tight">Ready to keep <br/> what you earn?</h2>
        <p className="text-xl opacity-90 mb-10 font-medium">Join 5,000+ independent sellers across Canada using Flavrr.</p>
        <div className="flex flex-col items-center gap-6">
          <button 
            onClick={() => window.location.href = '/signup'}
            className="bg-white text-[#FF4D00] px-10 py-5 rounded-[2rem] text-xl font-extrabold shadow-xl hover:scale-105 transition-transform flex items-center gap-3"
          >
            Get Started Free <ArrowRight />
          </button>
          <div className="flex flex-wrap justify-center gap-6 text-sm font-bold opacity-80">
            <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> No Commissions</span>
            <span className="flex items-center gap-2"><Truck className="w-4 h-4" /> Integrated Fleet</span>
            <span className="flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Proudly Canadian 🇨🇦</span>
          </div>
        </div>
      </div>
    </section>
  );
};

const Footer = () => {
  return (
    <footer className="py-12 px-6 border-t border-gray-100 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8 mb-8">
          <div className="flex items-center gap-2">
            <div className="bg-[#1A1A1A] p-1 rounded-md">
              <ShoppingBag className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-black tracking-tighter">flavrr</span>
          </div>
          
          <div className="flex gap-8 text-sm font-bold text-gray-500">
            <a href="/login" className="hover:text-[#FF4D00]">Login</a>
            <a href="#" className="hover:text-[#FF4D00]">Contact</a>
            <a href="#" className="hover:text-[#FF4D00]">Privacy</a>
            <a href="#" className="hover:text-[#FF4D00]">Terms</a>
          </div>
        </div>
        
        <div className="pt-8 border-t border-gray-50 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-[12px] text-gray-400 font-medium tracking-wide">© 2025 FLAVRR INC. MADE WITH ❤️ IN CANADA.</p>
          <div className="flex items-center gap-4">
             <Globe className="w-4 h-4 text-gray-300" />
             <span className="text-[10px] text-gray-400 font-black tracking-widest uppercase">Available Worldwide</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export const Landing: React.FC = () => {
  useEffect(() => {
    console.log('✅ Landing route rendered');
    
    const observerOptions = {
      root: null,
      rootMargin: '0px',
      threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('opacity-100');
          entry.target.classList.remove('opacity-0', 'translate-y-10');
        }
      });
    }, observerOptions);

    const sections = document.querySelectorAll('section');
    sections.forEach(section => {
      section.classList.add('transition-all', 'duration-1000', 'opacity-0', 'translate-y-10');
      observer.observe(section);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <Hero />
      <CustomerShowcase />
      <DeliverySection />
      <ReviewsSection />
      <CTASection />
      <Footer />
      
      <div className="fixed bottom-6 right-6 z-50">
        <button 
          onClick={() => window.location.href = '/signup'}
          className="bg-[#FF4D00] text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-transform group"
        >
          <Zap className="w-6 h-6 fill-current" />
        </button>
      </div>

      <style>{`
        .glass {
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid rgba(0, 0, 0, 0.05);
        }
        .gradient-text {
          background: linear-gradient(135deg, #FF4D00 0%, #FF9500 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .blob {
          position: absolute;
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, rgba(255,77,0,0.1) 0%, transparent 70%);
          border-radius: 50%;
          filter: blur(60px);
          pointer-events: none;
        }
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-bounce-slow {
          animation: bounce-slow 4s ease-in-out infinite;
        }
        @keyframes float-ambient {
          0%, 100% { transform: translateY(0); opacity: 0.9; }
          50% { transform: translateY(-8px); opacity: 1; }
        }
        @keyframes float-ambient-delayed {
          0%, 100% { transform: translateY(0); opacity: 0.9; }
          50% { transform: translateY(-6px); opacity: 1; }
        }
        .animate-float-ambient { animation: float-ambient 10s ease-in-out infinite; }
        .animate-float-ambient-delayed { animation: float-ambient-delayed 12s ease-in-out infinite; }
        @keyframes pulse-slow {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(0.98); }
        }
        .animate-pulse-slow {
          animation: pulse-slow 3s ease-in-out infinite;
        }
        @keyframes fade-in-down {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-down {
          animation: fade-in-down 0.4s ease-out forwards;
        }
        @keyframes marquee-reviews {
          0% { transform: translateX(0); }
          100% { transform: translateX(calc(-400px * 5 - 24px * 5)); }
        }
        .animate-marquee-reviews {
          animation: marquee-reviews 45s linear infinite;
        }
        .animate-marquee-reviews:hover {
          animation-play-state: paused;
        }
        @keyframes marquee-l {
          0% { transform: translateX(0); }
          100% { transform: translateX(calc(-280px * 5 - 24px * 5)); }
        }
        @keyframes marquee-r {
          0% { transform: translateX(calc(-280px * 5 - 24px * 5)); }
          100% { transform: translateX(0); }
        }
        .animate-marquee-l { animation: marquee-l 35s linear infinite; }
        .animate-marquee-r { animation: marquee-r 35s linear infinite; }
        .animate-marquee-l:hover, .animate-marquee-r:hover {
          animation-play-state: paused;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};
