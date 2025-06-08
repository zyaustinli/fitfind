#!/usr/bin/env python3
"""
Phase 3 Component Architecture Test Suite
Tests the implementation of:
- Collection management components (CollectionCard, CollectionGrid, CollectionModal, CollectionFilters)
- Save button components (SaveButton, QuickSaveButton, CollectionSaveButton)
- Collection item components (CollectionItemCard, CollectionItemsGrid)
- Component architecture patterns and best practices
"""

import os
import re
from pathlib import Path

def test_component_files_exist():
    """Test that all required component files exist"""
    print("🔍 Testing Component File Structure...")
    
    components_dir = Path("fitfind-frontend/src/components/collections")
    if not components_dir.exists():
        print("❌ Collections components directory not found")
        return False
    
    required_files = [
        "CollectionCard.tsx",
        "CollectionGrid.tsx", 
        "CollectionModal.tsx",
        "CollectionFilters.tsx",
        "SaveButton.tsx",
        "CollectionItemCard.tsx",
        "CollectionItemsGrid.tsx",
        "index.ts"
    ]
    
    missing_files = []
    for file_name in required_files:
        file_path = components_dir / file_name
        if not file_path.exists():
            missing_files.append(file_name)
    
    if missing_files:
        print(f"❌ Missing component files: {missing_files}")
        return False
    
    print("✅ All required component files exist")
    return True

def test_component_exports():
    """Test that components are properly exported"""
    print("\n🔍 Testing Component Exports...")
    
    index_file = Path("fitfind-frontend/src/components/collections/index.ts")
    if not index_file.exists():
        print("❌ Collections index file not found")
        return False
    
    content = index_file.read_text()
    
    required_exports = [
        "CollectionCard",
        "CollectionGrid",
        "CollectionModal", 
        "CollectionFilters",
        "SaveButton",
        "QuickSaveButton",
        "CollectionSaveButton",
        "CollectionItemCard",
        "CollectionItemsGrid"
    ]
    
    missing_exports = []
    for export_name in required_exports:
        if export_name not in content:
            missing_exports.append(export_name)
    
    if missing_exports:
        print(f"❌ Missing exports: {missing_exports}")
        return False
    
    print("✅ All required components are exported")
    return True

def test_component_structure():
    """Test component structure and patterns"""
    print("\n🔍 Testing Component Structure...")
    
    components_dir = Path("fitfind-frontend/src/components/collections")
    
    # Test key components for proper structure
    test_components = [
        {
            "file": "CollectionCard.tsx",
            "required_patterns": [
                r'"use client"',
                r'interface.*Props',
                r'export function CollectionCard',
                r'className\?:',
                r'cn\(',
                r'useState',
                r'onClick\?:'
            ]
        },
        {
            "file": "SaveButton.tsx", 
            "required_patterns": [
                r'"use client"',
                r'interface.*Props',
                r'export function SaveButton',
                r'useSaveItem',
                r'useCollections',
                r'variant.*=.*default',
                r'productId.*string'
            ]
        },
        {
            "file": "CollectionModal.tsx",
            "required_patterns": [
                r'"use client"',
                r'interface.*Props',
                r'export function CollectionModal',
                r'<Dialog.*>',
                r'useState',
                r'onSubmit.*Promise',
                r'validateForm'
            ]
        }
    ]
    
    for test_component in test_components:
        component_file = components_dir / test_component["file"]
        if not component_file.exists():
            continue
            
        content = component_file.read_text()
        
        for pattern in test_component["required_patterns"]:
            if not re.search(pattern, content, re.IGNORECASE):
                print(f"❌ {test_component['file']} missing pattern: {pattern}")
                return False
    
    print("✅ Component structures follow proper patterns")
    return True

def test_typescript_interfaces():
    """Test TypeScript interface definitions"""
    print("\n🔍 Testing TypeScript Interfaces...")
    
    components_dir = Path("fitfind-frontend/src/components/collections")
    
    # Check for proper TypeScript interfaces
    interface_tests = [
        {
            "file": "CollectionCard.tsx",
            "interfaces": ["CollectionCardProps"],
            "props": ["collection", "onEdit", "onDelete", "className"]
        },
        {
            "file": "SaveButton.tsx",
            "interfaces": ["SaveButtonProps", "QuickSaveButtonProps", "CollectionSaveButtonProps"],
            "props": ["productId", "variant", "onSave"]
        },
        {
            "file": "CollectionModal.tsx", 
            "interfaces": ["CollectionModalProps"],
            "props": ["open", "onOpenChange", "onSubmit", "collection"]
        }
    ]
    
    for test in interface_tests:
        component_file = components_dir / test["file"]
        if not component_file.exists():
            continue
            
        content = component_file.read_text()
        
        # Check interfaces exist
        for interface_name in test["interfaces"]:
            if f"interface {interface_name}" not in content:
                print(f"❌ {test['file']} missing interface: {interface_name}")
                return False
        
        # Check required props exist
        for prop in test["props"]:
            if f"{prop}" not in content:
                print(f"❌ {test['file']} missing prop: {prop}")
                return False
    
    print("✅ TypeScript interfaces properly defined")
    return True

def test_import_patterns():
    """Test proper import patterns"""
    print("\n🔍 Testing Import Patterns...")
    
    components_dir = Path("fitfind-frontend/src/components/collections")
    
    # Test key import patterns
    import_tests = [
        {
            "file": "CollectionCard.tsx",
            "required_imports": [
                "useState",
                "lucide-react",
                "@/lib/utils",
                "@/components/ui/button",
                "@/types"
            ]
        },
        {
            "file": "SaveButton.tsx",
            "required_imports": [
                "useState",
                "lucide-react", 
                "@/hooks",
                "@/components/ui/button",
                "@/types"
            ]
        },
        {
            "file": "CollectionModal.tsx",
            "required_imports": [
                "useState",
                "lucide-react",
                "@/components/ui/dialog",
                "@/components/ui/button",
                "@/components/ui/input"
            ]
        }
    ]
    
    for test in import_tests:
        component_file = components_dir / test["file"]
        if not component_file.exists():
            continue
            
        content = component_file.read_text()
        
        for import_pattern in test["required_imports"]:
            if import_pattern not in content:
                print(f"❌ {test['file']} missing import: {import_pattern}")
                return False
    
    print("✅ Import patterns are correct")
    return True

def test_hook_integration():
    """Test hook integration in components"""
    print("\n🔍 Testing Hook Integration...")
    
    save_button_file = Path("fitfind-frontend/src/components/collections/SaveButton.tsx")
    if save_button_file.exists():
        content = save_button_file.read_text()
        
        required_hooks = [
            "useSaveItem",
            "useCollections"
        ]
        
        for hook in required_hooks:
            if hook not in content:
                print(f"❌ SaveButton missing hook: {hook}")
                return False
        
        # Check hook usage patterns
        if "useSaveItem({" not in content:
            print("❌ SaveButton not properly using useSaveItem hook")
            return False
            
        if "useCollections({" not in content:
            print("❌ SaveButton not properly using useCollections hook")
            return False
    
    print("✅ Hook integration is correct")
    return True

def test_ui_component_usage():
    """Test proper UI component usage"""
    print("\n🔍 Testing UI Component Usage...")
    
    components_dir = Path("fitfind-frontend/src/components/collections")
    
    # Check for proper UI component usage
    ui_tests = [
        {
            "file": "CollectionCard.tsx",
            "ui_components": ["Button", "Badge", "Card"]
        },
        {
            "file": "CollectionModal.tsx",
            "ui_components": ["Dialog", "DialogContent", "Button", "Input", "Label"]
        },
        {
            "file": "CollectionFilters.tsx",
            "ui_components": ["Button", "Input", "Badge", "Card"]
        }
    ]
    
    for test in ui_tests:
        component_file = components_dir / test["file"]
        if not component_file.exists():
            continue
            
        content = component_file.read_text()
        
        for ui_component in test["ui_components"]:
            if f"<{ui_component}" not in content:
                print(f"❌ {test['file']} not using UI component: {ui_component}")
                return False
    
    print("✅ UI component usage is correct")
    return True

def test_accessibility_patterns():
    """Test accessibility patterns"""
    print("\n🔍 Testing Accessibility Patterns...")
    
    components_dir = Path("fitfind-frontend/src/components/collections")
    
    # Check for basic accessibility patterns
    accessibility_tests = [
        {
            "file": "CollectionModal.tsx",
            "patterns": ["aria-", "htmlFor", "alt="]
        },
        {
            "file": "CollectionCard.tsx", 
            "patterns": ["alt=", "aria-"]
        },
        {
            "file": "SaveButton.tsx",
            "patterns": ["disabled", "aria-"]
        }
    ]
    
    for test in accessibility_tests:
        component_file = components_dir / test["file"]
        if not component_file.exists():
            continue
            
        content = component_file.read_text()
        
        accessibility_found = False
        for pattern in test["patterns"]:
            if pattern in content:
                accessibility_found = True
                break
        
        if not accessibility_found:
            print(f"❌ {test['file']} missing accessibility patterns")
            return False
    
    print("✅ Accessibility patterns present")
    return True

def test_responsive_design():
    """Test responsive design patterns"""
    print("\n🔍 Testing Responsive Design...")
    
    components_dir = Path("fitfind-frontend/src/components/collections")
    
    # Check for responsive design patterns
    responsive_patterns = [
        "sm:",
        "md:",
        "lg:",
        "grid-cols-",
        "flex-col.*sm:flex-row"
    ]
    
    responsive_files = ["CollectionGrid.tsx", "CollectionFilters.tsx", "CollectionItemsGrid.tsx"]
    
    for file_name in responsive_files:
        component_file = components_dir / file_name
        if not component_file.exists():
            continue
            
        content = component_file.read_text()
        
        responsive_found = False
        for pattern in responsive_patterns:
            if re.search(pattern, content):
                responsive_found = True
                break
        
        if not responsive_found:
            print(f"❌ {file_name} missing responsive design patterns")
            return False
    
    print("✅ Responsive design patterns present")
    return True

def run_all_tests():
    """Run all Phase 3 component tests"""
    print("🚀 Running Phase 3 Component Architecture Tests\n")
    
    tests = [
        test_component_files_exist,
        test_component_exports,
        test_component_structure,
        test_typescript_interfaces,
        test_import_patterns,
        test_hook_integration,
        test_ui_component_usage,
        test_accessibility_patterns,
        test_responsive_design
    ]
    
    results = []
    for test in tests:
        results.append(test())
    
    print(f"\n📊 Test Results: {sum(results)}/{len(results)} passed")
    
    if all(results):
        print("🎉 All Phase 3 component architecture tests passed!")
        print("\n✅ Phase 3: Component Architecture - COMPLETE")
        print("\nReady for Phase 4: Page Updates")
        return True
    else:
        print("❌ Some tests failed. Please review the implementation.")
        return False

if __name__ == "__main__":
    success = run_all_tests()
    exit(0 if success else 1) 