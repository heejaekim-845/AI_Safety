import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
  QrCode, 
  ClipboardList, 
  Settings 
} from "lucide-react";
import shieldIcon from "@assets/shield_1495706_1751373357053.png";

interface BottomNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function BottomNavigation({ activeTab, onTabChange }: BottomNavigationProps) {
  const [location, setLocation] = useLocation();

  // Extract equipment ID from current location if available
  const equipmentIdMatch = location.match(/\/equipment\/(\d+)/);
  const currentEquipmentId = equipmentIdMatch ? equipmentIdMatch[1] : "1";

  const tabs = [
    {
      id: "scanner",
      label: "스캔",
      icon: QrCode,
      path: "/"
    },
    {
      id: "dashboard",
      label: "대시보드",
      icon: "shield",
      path: `/equipment/${currentEquipmentId}`
    },
    {
      id: "work",
      label: "작업",
      icon: ClipboardList,
      path: `/equipment/${currentEquipmentId}/work-types`
    },
    {
      id: "admin",
      label: "관리",
      icon: Settings,
      path: "/admin"
    }
  ];

  const handleTabClick = (tab: typeof tabs[0]) => {
    onTabChange(tab.id);
    setLocation(tab.path);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200/50 max-w-md mx-auto z-40 h-20 shadow-2xl">
      <div className="grid grid-cols-4 py-3 px-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          
          return (
            <Button
              key={tab.id}
              variant="ghost"
              className={cn(
                "flex flex-col items-center py-3 h-auto space-y-1 rounded-2xl transition-all duration-300",
                isActive 
                  ? "bg-blue-600 text-white shadow-lg scale-105" 
                  : "text-gray-400 hover:text-gray-600 hover:bg-gray-100/60"
              )}
              onClick={() => handleTabClick(tab)}
            >
              {tab.icon === "shield" ? (
                <img 
                  src={shieldIcon} 
                  alt="대시보드" 
                  className={cn("h-6 w-6", isActive && "animate-pulse")} 
                />
              ) : (
                <>
                  {(() => {
                    const IconComponent = tab.icon as any;
                    return <IconComponent className={cn("h-6 w-6", isActive && "animate-pulse")} />;
                  })()}
                </>
              )}
              <span className="text-xs font-medium">{tab.label}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
