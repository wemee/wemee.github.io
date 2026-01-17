import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react';
import type { ReactNode } from 'react';

interface TabItem {
    label: string;
    icon?: string;
    content: ReactNode;
}

interface TabsProps {
    tabs: TabItem[];
    defaultIndex?: number;
}

export function Tabs({ tabs, defaultIndex = 0 }: TabsProps) {
    return (
        <TabGroup defaultIndex={defaultIndex}>
            <TabList className="flex border-b border-base-600 mb-6">
                {tabs.map((tab, index) => (
                    <Tab
                        key={index}
                        className={({ selected }) =>
                            `px-4 py-2 font-medium border-b-2 transition-colors outline-none ${selected
                                ? 'text-base-50 border-accent-blue'
                                : 'text-base-400 border-transparent hover:text-base-50'
                            }`
                        }
                    >
                        {tab.icon && <span className="mr-1">{tab.icon}</span>}
                        {tab.label}
                    </Tab>
                ))}
            </TabList>
            <TabPanels>
                {tabs.map((tab, index) => (
                    <TabPanel key={index}>
                        {tab.content}
                    </TabPanel>
                ))}
            </TabPanels>
        </TabGroup>
    );
}

export default Tabs;
