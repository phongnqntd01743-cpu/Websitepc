const products = [
{id:1,name:"AMD Ryzen 7 7800X3D",category:"CPU",brand:"AMD",price:8990000,oldPrice:10990000,image:"assets/images/products/amd-ryzen-7-7800x3d.png",description:"CPU gaming 8 nhân 16 luồng, nền tảng AM5 hàng đầu cho game thủ.",stock:18,rating:4.9,reviews:128,isNew:true,isHot:false,isSale:false,socket:"AM5",ramType:"DDR5",powerConsumption:120,recommendedPSU:650},
{id:2,name:"AMD Ryzen 5 7600",category:"CPU",brand:"AMD",price:5290000,oldPrice:5790000,image:"assets/images/products/amd-ryzen-5-7600.png",description:"CPU 6 nhân 12 luồng cân bằng gaming và công việc, socket AM5.",stock:25,rating:4.8,reviews:45,isNew:false,isHot:false,isSale:false,socket:"AM5",ramType:"DDR5",powerConsumption:65,recommendedPSU:550},
{id:3,name:"Intel Core i5-13400F",category:"CPU",brand:"Intel",price:4190000,oldPrice:4590000,image:"assets/images/products/intel-core-i5-13400f.png",description:"CPU gaming phổ thông 10 nhân 16 luồng socket LGA1700.",stock:20,rating:4.7,reviews:82,isNew:false,isHot:true,isSale:true,socket:"LGA1700",ramType:"DDR4",powerConsumption:148,recommendedPSU:650},
{id:4,name:"NVIDIA RTX 4070 SUPER",category:"GPU",brand:"ASUS",price:16990000,oldPrice:19990000,image:"assets/images/products/asus-rtx-4070-super.png",description:"GPU ASUS Dual RTX 4070 SUPER 12GB GDDR6X hiệu năng cao 1440p/4K.",stock:8,rating:4.8,reviews:96,isNew:true,isHot:false,isSale:false,powerConsumption:220,recommendedPSU:650,gpuLength:310},
{id:5,name:"NVIDIA RTX 5070",category:"GPU",brand:"MSI",price:18990000,oldPrice:19990000,image:"assets/images/products/msi-rtx-5070.png",description:"GPU MSI GeForce RTX 5070 thế hệ mới với 12GB GDDR7 cực mạnh.",stock:7,rating:4.9,reviews:15,isNew:false,isHot:false,isSale:false,powerConsumption:250,recommendedPSU:650,gpuLength:320},
{id:6,name:"NVIDIA RTX 4060 Ti Ventus",category:"GPU",brand:"MSI",price:10990000,oldPrice:11990000,image:"assets/images/products/msi-rtx-4060-ti-ventus.png",description:"GPU MSI GeForce RTX 4060 Ti Ventus 2X nhỏ gọn cho gaming FHD/2K.",stock:12,rating:4.7,reviews:73,isNew:false,isHot:true,isSale:true,powerConsumption:160,recommendedPSU:550,gpuLength:305},
{id:7,name:"Corsair Vengeance DDR5 32GB",category:"RAM",brand:"Corsair",price:2890000,oldPrice:3490000,image:"assets/images/products/corsair-vengeance-ddr5-32gb.png",description:"Bộ nhớ Corsair Vengeance DDR5 32GB (2x16GB) tốc độ cao 5600MHz.",stock:40,rating:4.7,reviews:76,isNew:true,isHot:false,isSale:false,ramType:"DDR5",powerConsumption:10},
{id:8,name:"Kingston Fury Beast DDR4 16GB",category:"RAM",brand:"Kingston",price:990000,oldPrice:1190000,image:"assets/images/products/kingston-fury-beast-ddr4-16gb.png",description:"RAM Kingston Fury Beast DDR4 16GB 3200MHz ổn định cho hệ thống phổ thông.",stock:35,rating:4.6,reviews:94,isNew:false,isHot:false,isSale:true,ramType:"DDR4",powerConsumption:8},
{id:9,name:"MSI B650M Gaming Plus",category:"Mainboard",brand:"MSI",price:4290000,oldPrice:4990000,image:"assets/images/products/msi-b650m-gaming-plus.png",description:"Mainboard MSI B650M Gaming Plus WIFI socket AM5, hỗ trợ RAM DDR5.",stock:15,rating:4.6,reviews:64,isNew:true,isHot:false,isSale:true,socket:"AM5",ramType:"DDR5",formFactor:"mATX",powerConsumption:50},
{id:10,name:"ASUS PRIME B760M-A",category:"Mainboard",brand:"ASUS",price:3390000,oldPrice:3690000,image:"assets/images/products/asus-prime-b760m-a.png",description:"Mainboard ASUS PRIME B760M-A D4 socket LGA1700 cho Intel Gen 12/13/14.",stock:19,rating:4.6,reviews:41,isNew:false,isHot:false,isSale:false,socket:"LGA1700",ramType:"DDR4",formFactor:"mATX",powerConsumption:50},
{id:11,name:"Samsung 990 EVO 1TB",category:"SSD",brand:"Samsung",price:2190000,oldPrice:2590000,image:"assets/images/products/samsung-990-evo-1tb.png",description:"SSD Samsung 990 EVO 1TB PCIe 4.0/5.0 NVMe M.2 tốc độ đọc 5000MB/s.",stock:31,rating:4.8,reviews:112,isNew:false,isHot:false,isSale:true,storageType:"NVMe",powerConsumption:8},
{id:12,name:"WD Blue SN580 2TB",category:"SSD",brand:"WD",price:3290000,oldPrice:3790000,image:"assets/images/products/wd-blue-sn580-2tb.png",description:"SSD WD Blue SN580 2TB PCIe Gen4 NVMe dung lượng lớn, phù hợp gaming.",stock:24,rating:4.7,reviews:58,isNew:false,isHot:false,isSale:false,storageType:"NVMe",powerConsumption:8},
{id:13,name:"DeepCool PK750D 750W",category:"PSU",brand:"DeepCool",price:1690000,oldPrice:1890000,image:"assets/images/products/deepcool-pk750d-750w.png",description:"Nguồn DeepCool PK750D 750W 80 Plus Bronze tải ổn định cấu hình gaming.",stock:21,rating:4.5,reviews:67,isNew:false,isHot:false,isSale:true,wattage:750,powerConsumption:0},
{id:14,name:"Corsair RM850e 850W",category:"PSU",brand:"Corsair",price:2890000,oldPrice:3190000,image:"assets/images/products/corsair-rm850e-850w.png",description:"Nguồn Full Modular Corsair RM850e 850W 80 Plus Gold ATX 3.0 PCIe 5.0.",stock:11,rating:4.8,reviews:89,isNew:false,isHot:false,isSale:false,wattage:850,powerConsumption:0},
{id:15,name:"DeepCool CH370",category:"Case",brand:"DeepCool",price:1490000,oldPrice:1690000,image:"assets/images/products/deepcool-ch370.png",description:"Vỏ case DeepCool CH370 Micro-ATX nhỏ gọn, kính cường lực, GPU 320mm.",stock:17,rating:4.5,reviews:33,isNew:false,isHot:false,isSale:true,formFactor:"mATX",gpuSupport:320,powerConsumption:0},
{id:16,name:"NZXT H5 Flow",category:"Case",brand:"NZXT",price:2190000,oldPrice:2490000,image:"assets/images/products/nzxt-h5-flow.png",description:"Vỏ case NZXT H5 Flow ATX Mid-Tower luồng khí tối ưu, GPU support 365mm.",stock:10,rating:4.7,reviews:78,isNew:false,isHot:false,isSale:false,formFactor:"ATX",gpuSupport:365,powerConsumption:0},
{id:17,name:"DeepCool AK620",category:"Cooler",brand:"DeepCool",price:1490000,oldPrice:1690000,image:"assets/images/products/deepcool-ak620.png",description:"Tản nhiệt khí DeepCool AK620 Dual-Tower 6 ống đồng tản nhiệt tối ưu.",stock:16,rating:4.6,reviews:61,isNew:false,isHot:true,isSale:true,powerConsumption:10},
{id:18,name:"DeepCool LS520 SE 240",category:"Cooler",brand:"DeepCool",price:1890000,oldPrice:2190000,image:"assets/images/products/deepcool-ls520-se-240.png",description:"Tản nhiệt nước AIO DeepCool LS520 SE 240mm ARGB làm mát hiệu suất cao.",stock:13,rating:4.6,reviews:52,isNew:false,isHot:false,isSale:false,powerConsumption:15},
{id:19,name:"Kingston NV2 1TB",category:"SSD",brand:"Kingston",price:1590000,oldPrice:1790000,image:"assets/images/products/kingston-nv2-1tb.png",description:"SSD Kingston NV2 1TB PCIe 4.0 NVMe M.2 2280 tốc độ cao, giá tối ưu.",stock:30,rating:4.5,reviews:54,isNew:false,isHot:true,isSale:true,storageType:"NVMe",powerConsumption:7},
{id:20,name:"AOC 25G3ZM 24.5 240Hz",category:"Monitor",brand:"AOC",price:3990000,oldPrice:4590000,image:"assets/images/products/aoc-25g3zm.png",description:"Màn hình gaming AOC 25G3ZM 24.5 inch FHD 240Hz 0.5ms FreeSync Premium.",stock:14,rating:4.7,reviews:88,isNew:false,isHot:false,isSale:false,powerConsumption:35},
{id:21,name:"Keychron C3 Pro",category:"Keyboard",brand:"Keychron",price:1390000,oldPrice:1590000,image:"assets/images/products/keychron-c3-pro.png",description:"Bàn phím cơ Keychron C3 Pro TKL QMK/VIA Gasket mount switch đỏ êm ái.",stock:22,rating:4.7,reviews:46,isNew:false,isHot:false,isSale:true,powerConsumption:5},
{id:22,name:"Logitech G304",category:"Mouse",brand:"Logitech",price:790000,oldPrice:990000,image:"assets/images/products/logitech-g304.png",description:"Chuột không dây gaming Logitech G304 Lightspeed cảm biến HERO 12K.",stock:32,rating:4.8,reviews:150,isNew:false,isHot:false,isSale:true,powerConsumption:3},
{id:23,name:"HyperX Cloud III",category:"Headset",brand:"HyperX",price:1990000,oldPrice:2290000,image:"assets/images/products/hyperx-cloud-iii.png",description:"Tai nghe gaming HyperX Cloud III âm thanh DTS Spatial Audio đệm mút siêu êm.",stock:18,rating:4.7,reviews:63,isNew:false,isHot:false,isSale:false,powerConsumption:3},
{id:24,name:"Seagate Barracuda 2TB",category:"HDD",brand:"Seagate",price:1590000,oldPrice:1790000,image:"assets/images/products/seagate-barracuda-2tb.png",description:"Ổ cứng HDD Seagate BarraCuda 2TB 3.5 inch 7200RPM 256MB Cache lưu trữ lớn.",stock:20,rating:4.5,reviews:39,isNew:false,isHot:false,isSale:true,storageType:"HDD",powerConsumption:8}
];

const categories = ["CPU","GPU","RAM","Mainboard","SSD","HDD","PSU","Case","Cooler","Monitor","Keyboard","Mouse","Headset"];

const categoryIcons = {
  CPU: "assets/images/icons/cpu.png",
  GPU: "assets/images/icons/gpu.png",
  RAM: "assets/images/icons/ram.png",
  Mainboard: "assets/images/icons/mainboard.png",
  SSD: "assets/images/icons/ssd.png",
  HDD: "assets/images/icons/hdd.png",
  PSU: "assets/images/icons/psu.png",
  Case: "assets/images/icons/case.png",
  Cooler: "assets/images/icons/cooler.png",
  Monitor: "assets/images/icons/monitor.png",
  Keyboard: "assets/images/icons/keyboard.png",
  Mouse: "assets/images/icons/mouse.png",
  Gear: "assets/images/icons/mouse.png",
  Headset: "assets/images/icons/headset.png"
};

const categorySymbols = {CPU:"▣",GPU:"▰",RAM:"▤",Mainboard:"▦",SSD:"▥",HDD:"◫",PSU:"▣",Case:"▥",Cooler:"✣",Monitor:"▱",Keyboard:"⌨",Mouse:"◉",Gear:"◉",Headset:"◖"};

const miniBuilderCategories = ["CPU","Mainboard","RAM","GPU","SSD","PSU","Case","Cooler"];
const builderCategories = ["CPU","Cooler","Mainboard","RAM","GPU","SSD","HDD","PSU","Case"];

