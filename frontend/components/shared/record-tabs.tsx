'use client';

import { useState } from 'react';

interface Tab {
  label: string;
  value: string;
  content: React.ReactNode;
}

interface RecordTabsProps {
  tabs: Tab[];
  defaultTab?: string;
}

export function RecordTabs({ tabs, defaultTab }: RecordTabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.value);

  const currentTab = tabs.find((tab) => tab.value === activeTab);

  return (
    <div>
      <div className="bg-white border-b border-gray-200">
        <div className="px-6">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.value
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>
      <div className="p-6">{currentTab?.content}</div>
    </div>
  );
}
