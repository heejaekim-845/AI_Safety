import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
  QrCode, 
  LayoutDashboard, 
  ClipboardList, 
  Settings 
} from "lucide-react";

interface BottomNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function BottomNavigation({ activeTab, onTabChange }: BottomNavigationProps) {
  const [, setLocation] = useLocation();

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
      icon: LayoutDashboard,
      path: "/equipment/1" // Default to first equipment for demo
    },
    {
      id: "work",
      label: "작업",
      icon: ClipboardList,
      path: "/equipment/1/work-types"
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
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 max-w-md mx-auto z-40">
      <div className="grid grid-cols-4 py-2">
        {tabs.map((tab) => {
          const IconComponent = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <Button
              key={tab.id}
              variant="ghost"
              className={cn(
                "flex flex-col items-center py-2 h-auto space-y-1",
                isActive ? "text-primary" : "text-gray-400"
              )}
              onClick={() => handleTabClick(tab)}
            >
              <IconComponent className="h-5 w-5" />
              <span className="text-xs">{tab.label}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
