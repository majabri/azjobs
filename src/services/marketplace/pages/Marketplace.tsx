import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Package, ShoppingCart, Briefcase } from "lucide-react";
import ServiceBrowser from "@/components/marketplace/ServiceBrowser";
import TalentServicesDashboard from "@/components/marketplace/TalentServicesDashboard";
import BuyerOrdersDashboard from "@/components/marketplace/BuyerOrdersDashboard";

export default function Marketplace() {
  const [tab, setTab] = useState("browse");

  return (
    <div className="container max-w-7xl mx-auto py-6 px-4 space-y-6">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="browse"><Search className="w-4 h-4 mr-1" /> Browse</TabsTrigger>
          <TabsTrigger value="selling"><Briefcase className="w-4 h-4 mr-1" /> Selling</TabsTrigger>
          <TabsTrigger value="buying"><ShoppingCart className="w-4 h-4 mr-1" /> Buying</TabsTrigger>
        </TabsList>
        <TabsContent value="browse"><ServiceBrowser /></TabsContent>
        <TabsContent value="selling"><TalentServicesDashboard /></TabsContent>
        <TabsContent value="buying"><BuyerOrdersDashboard /></TabsContent>
      </Tabs>
    </div>
  );
}
