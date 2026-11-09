import { Routes, Route } from "react-router-dom";
import SiteLayout from "@/components/SiteLayout";
import Home from "@/pages/Home";
import Technology from "@/pages/Technology";
import Budget from "@/pages/Budget";
import Pricing from "@/pages/Pricing";
import Pitch from "@/pages/Pitch";
import Advisor from "@/pages/Advisor";
import Memorials from "@/pages/Memorials";
import MemorialStudio from "@/pages/MemorialStudio";
import MemoryShow from "@/pages/MemoryShow";
import Orders from "@/pages/Orders";
import Intake from "@/pages/Intake";
import Review from "@/pages/Review";
import FamilyLayout from "@/components/FamilyLayout";
import RequireStaff from "@/components/RequireStaff";
import Login from "@/pages/Login";

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/technology" element={<Technology />} />
        <Route path="/budget" element={<Budget />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/pitch" element={<Pitch />} />
        <Route path="/login" element={<Login />} />
        <Route element={<RequireStaff />}>
          <Route path="/advisor" element={<Advisor />} />
          <Route path="/memorials" element={<Memorials />} />
          <Route path="/memorials/:id" element={<MemorialStudio />} />
          <Route path="/orders" element={<Orders />} />
        </Route>
        <Route path="*" element={<Home />} />
      </Route>
      <Route element={<FamilyLayout />}>
        <Route path="/intake/:token" element={<Intake />} />
        <Route path="/review/:token" element={<Review />} />
      </Route>
      <Route path="/memorials/:id/show" element={<MemoryShow />} />
    </Routes>
  );
}
