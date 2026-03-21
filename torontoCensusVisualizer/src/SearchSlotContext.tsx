import { createContext, useContext, useState, type ReactNode } from "react";

interface SearchSlotContextType {
  slot:    ReactNode;
  setSlot: (slot: ReactNode) => void;
}

const SearchSlotContext = createContext<SearchSlotContextType>({
  slot: null, setSlot: () => {},
});

export function SearchSlotProvider({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<ReactNode>(null);
  return (
    <SearchSlotContext.Provider value={{ slot, setSlot }}>
      {children}
    </SearchSlotContext.Provider>
  );
}

export const useSearchSlot = () => useContext(SearchSlotContext);