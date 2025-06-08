#!/usr/bin/env python3
"""
Phase 4: Page Updates - Test Suite
Tests the integration of collection components into pages and navigation updates.
"""

import os
import re
import sys
from pathlib import Path

def test_navigation_updates():
    """Test that navigation has been updated with Collections link"""
    print("🧪 Testing navigation updates...")
    
    header_path = Path("fitfind-frontend/src/components/layout/Header.tsx")
    if not header_path.exists():
        print("❌ Header component not found")
        return False
    
    content = header_path.read_text()
    
    # Test 1: FolderHeart icon import
    if "FolderHeart" not in content:
        print("❌ FolderHeart icon not imported in Header")
        return False
    
    # Test 2: Collections link in desktop navigation
    desktop_nav_pattern = r'href="/collections".*?Collections'
    if not re.search(desktop_nav_pattern, content, re.DOTALL):
        print("❌ Collections link not found in desktop navigation")
        return False
    
    # Test 3: Collections link in mobile navigation
    mobile_nav_count = len(re.findall(r'href="/collections"', content))
    if mobile_nav_count < 2:  # Should appear in both desktop and mobile
        print("❌ Collections link not found in mobile navigation")
        return False
    
    print("✅ Navigation updates verified")
    return True

def test_collections_listing_page():
    """Test the main collections listing page"""
    print("🧪 Testing collections listing page...")
    
    page_path = Path("fitfind-frontend/src/app/collections/page.tsx")
    if not page_path.exists():
        print("❌ Collections listing page not found")
        return False
    
    content = page_path.read_text()
    
    # Test 1: Required imports
    required_imports = [
        "useCollections",
        "CollectionGrid",
        "CollectionFilters", 
        "CollectionModal",
        "FolderHeart",
        "Plus"
    ]
    
    for import_name in required_imports:
        if import_name not in content:
            print(f"❌ Missing import: {import_name}")
            return False
    
    # Test 2: Authentication handling
    auth_patterns = [
        r"const.*user.*loading.*authLoading.*useAuth",
        r"if.*authLoading.*return",
        r"if.*!user.*return"
    ]
    
    for pattern in auth_patterns:
        if not re.search(pattern, content, re.DOTALL):
            print(f"❌ Missing authentication pattern: {pattern}")
            return False
    
    # Test 3: Collections hook usage
    hook_pattern = r"useCollections\(\{[^}]*autoFetch.*!!user"
    if not re.search(hook_pattern, content, re.DOTALL):
        print("❌ Collections hook not properly configured")
        return False
    
    # Test 4: Component usage
    components = ["CollectionGrid", "CollectionFilters", "CollectionModal"]
    for component in components:
        if f"<{component}" not in content:
            print(f"❌ Component not used: {component}")
            return False
    
    # Test 5: Event handlers
    handlers = [
        "handleCreateCollection",
        "handleEditCollection", 
        "handleDeleteCollection",
        "handleFiltersChange"
    ]
    
    for handler in handlers:
        if handler not in content:
            print(f"❌ Missing event handler: {handler}")
            return False
    
    print("✅ Collections listing page verified")
    return True

def test_collection_detail_page():
    """Test the collection detail page"""
    print("🧪 Testing collection detail page...")
    
    page_path = Path("fitfind-frontend/src/app/collections/[id]/page.tsx")
    if not page_path.exists():
        print("❌ Collection detail page not found")
        return False
    
    content = page_path.read_text()
    
    # Test 1: Required imports
    required_imports = [
        "useParams",
        "useRouter", 
        "useCollections",
        "useCollectionItems",
        "CollectionItemsGrid",
        "CollectionModal",
        "ArrowLeft"
    ]
    
    for import_name in required_imports:
        if import_name not in content:
            print(f"❌ Missing import: {import_name}")
            return False
    
    # Test 2: URL parameter handling
    param_patterns = [
        r"useParams\(\)",
        r"params\.id.*string",
        r"collectionId.*params\.id"
    ]
    
    for pattern in param_patterns:
        if not re.search(pattern, content, re.DOTALL):
            print(f"❌ Missing parameter handling: {pattern}")
            return False
    
    # Test 3: Collection not found handling
    not_found_pattern = r"Collection Not Found"
    if not re.search(not_found_pattern, content):
        print("❌ Missing collection not found handling")
        return False
    
    # Test 4: Collection items integration
    items_patterns = [
        r"useCollectionItems\(\{",
        r"collectionId",
        r"autoFetch.*!!user.*!!collection"
    ]
    
    for pattern in items_patterns:
        if not re.search(pattern, content, re.DOTALL):
            print(f"❌ Missing collection items pattern: {pattern}")
            return False
    
    # Test 5: Action handlers
    actions = [
        "handleEditCollection",
        "handleDeleteCollection", 
        "handleShareCollection",
        "handleItemRemove",
        "handleItemsReorder"
    ]
    
    for action in actions:
        if action not in content:
            print(f"❌ Missing action handler: {action}")
            return False
    
    print("✅ Collection detail page verified")
    return True

def test_wishlist_collections_integration():
    """Test collections integration in wishlist page"""
    print("🧪 Testing wishlist collections integration...")
    
    page_path = Path("fitfind-frontend/src/app/wishlist/page.tsx")
    if not page_path.exists():
        print("❌ Wishlist page not found")
        return False
    
    content = page_path.read_text()
    
    # Test 1: Collections imports
    collections_imports = [
        "useCollections",
        "CollectionModal",
        "FolderHeart"
    ]
    
    for import_name in collections_imports:
        if import_name not in content:
            print(f"❌ Missing collections import: {import_name}")
            return False
    
    # Test 2: Collections hook usage
    hook_pattern = r"useCollections\(\{[^}]*autoFetch.*!!user"
    if not re.search(hook_pattern, content, re.DOTALL):
        print("❌ Collections hook not integrated")
        return False
    
    # Test 3: Collections buttons in header
    button_patterns = [
        r'onClick.*router\.push.*[\'"/]collections[\'"]',
        r'onClick.*setShowCreateCollectionModal.*true'
    ]
    
    for pattern in button_patterns:
        if not re.search(pattern, content, re.DOTALL):
            print(f"❌ Missing collections button: {pattern}")
            return False
    
    # Test 4: Collection creation modal
    modal_pattern = r"<CollectionModal[^>]*open.*showCreateCollectionModal"
    if not re.search(modal_pattern, content, re.DOTALL):
        print("❌ Collection creation modal not integrated")
        return False
    
    # Test 5: Bulk action for collections
    bulk_action_pattern = r"case.*add_to_collection"
    if not re.search(bulk_action_pattern, content):
        print("❌ Add to collection bulk action not implemented")
        return False
    
    print("✅ Wishlist collections integration verified")
    return True

def test_product_card_integration():
    """Test that ProductCard maintains save functionality"""
    print("🧪 Testing ProductCard save functionality...")
    
    card_path = Path("fitfind-frontend/src/components/ui/product-card.tsx")
    if not card_path.exists():
        print("❌ ProductCard component not found")
        return False
    
    content = card_path.read_text()
    
    # Test 1: Save functionality preserved
    save_patterns = [
        r"onSave.*onRemove.*isSaved",
        r"handleSaveToggle",
        r"Heart.*className.*isSaved.*fill-current"
    ]
    
    for pattern in save_patterns:
        if not re.search(pattern, content, re.DOTALL):
            print(f"❌ Save functionality pattern missing: {pattern}")
            return False
    
    # Test 2: Button structure maintained
    button_pattern = r"<Button[^>]*onClick.*handleSaveToggle"
    if not re.search(button_pattern, content, re.DOTALL):
        print("❌ Save button structure not maintained")
        return False
    
    print("✅ ProductCard save functionality verified")
    return True

def test_page_routing_structure():
    """Test that page routing structure is correct"""
    print("🧪 Testing page routing structure...")
    
    # Test 1: Collections route exists
    collections_dir = Path("fitfind-frontend/src/app/collections")
    if not collections_dir.exists():
        print("❌ Collections route directory not found")
        return False
    
    # Test 2: Dynamic route exists
    dynamic_dir = Path("fitfind-frontend/src/app/collections/[id]")
    if not dynamic_dir.exists():
        print("❌ Dynamic collection route directory not found")
        return False
    
    # Test 3: Required page files exist
    required_pages = [
        "fitfind-frontend/src/app/collections/page.tsx",
        "fitfind-frontend/src/app/collections/[id]/page.tsx"
    ]
    
    for page_path in required_pages:
        if not Path(page_path).exists():
            print(f"❌ Required page not found: {page_path}")
            return False
    
    print("✅ Page routing structure verified")
    return True

def test_component_exports():
    """Test that all collection components are properly exported"""
    print("🧪 Testing collection component exports...")
    
    index_path = Path("fitfind-frontend/src/components/collections/index.ts")
    if not index_path.exists():
        print("❌ Collections index file not found")
        return False
    
    content = index_path.read_text()
    
    # Test 1: All components exported
    required_exports = [
        "CollectionCard",
        "CollectionGrid", 
        "CollectionModal",
        "CollectionFilters",
        "CollectionItemCard",
        "CollectionItemsGrid",
        "SaveButton",
        "QuickSaveButton",
        "CollectionSaveButton"
    ]
    
    for export_name in required_exports:
        if export_name not in content:
            print(f"❌ Component not exported: {export_name}")
            return False
    
    print("✅ Component exports verified")
    return True

def test_typescript_integration():
    """Test TypeScript integration and type usage"""
    print("🧪 Testing TypeScript integration...")
    
    # Test collections page types
    collections_page = Path("fitfind-frontend/src/app/collections/page.tsx")
    if collections_page.exists():
        content = collections_page.read_text()
        
        # Test type imports
        type_patterns = [
            r"import.*type.*Collection.*from",
            r"CollectionFiltersState",
            r"useState<.*>",
            r"const.*Collection.*null"
        ]
        
        for pattern in type_patterns:
            if not re.search(pattern, content, re.DOTALL):
                print(f"❌ TypeScript pattern missing in collections page: {pattern}")
                return False
    
    # Test collection detail page types
    detail_page = Path("fitfind-frontend/src/app/collections/[id]/page.tsx")
    if detail_page.exists():
        content = detail_page.read_text()
        
        # Test parameter typing
        param_patterns = [
            r"params\.id.*as string",
            r"CollectionItem.*from",
            r"Collection.*CollectionItem"
        ]
        
        for pattern in param_patterns:
            if not re.search(pattern, content, re.DOTALL):
                print(f"❌ TypeScript pattern missing in detail page: {pattern}")
                return False
    
    print("✅ TypeScript integration verified")
    return True

def test_responsive_design_patterns():
    """Test responsive design patterns in pages"""
    print("🧪 Testing responsive design patterns...")
    
    pages_to_test = [
        "fitfind-frontend/src/app/collections/page.tsx",
        "fitfind-frontend/src/app/collections/[id]/page.tsx"
    ]
    
    for page_path in pages_to_test:
        if not Path(page_path).exists():
            continue
            
        content = Path(page_path).read_text()
        
        # Test responsive classes
        responsive_patterns = [
            r"sm:",
            r"md:",
            r"container.*mx-auto",
            r"px-4.*sm:px-6.*lg:px-8"
        ]
        
        found_responsive = 0
        for pattern in responsive_patterns:
            if re.search(pattern, content):
                found_responsive += 1
        
        if found_responsive < 2:  # Should have at least 2 responsive patterns
            print(f"❌ Insufficient responsive patterns in {page_path}")
            return False
    
    print("✅ Responsive design patterns verified")
    return True

def test_accessibility_features():
    """Test accessibility features in pages"""
    print("🧪 Testing accessibility features...")
    
    pages_to_test = [
        "fitfind-frontend/src/app/collections/page.tsx",
        "fitfind-frontend/src/app/collections/[id]/page.tsx"
    ]
    
    for page_path in pages_to_test:
        if not Path(page_path).exists():
            continue
            
        content = Path(page_path).read_text()
        
        # Test accessibility patterns
        a11y_patterns = [
            r'alt="',
            r'aria-',
            r'role="',
            r'title="',
            r'disabled.*true'
        ]
        
        found_patterns = 0
        for pattern in a11y_patterns:
            if re.search(pattern, content):
                found_patterns += 1
        
        if found_patterns < 2:  # Should have at least 2 accessibility features
            print(f"❌ Insufficient accessibility features in {page_path}")
            return False
    
    print("✅ Accessibility features verified")
    return True

def run_all_tests():
    """Run all Phase 4 tests"""
    print("🚀 Starting Phase 4: Page Updates Tests")
    print("=" * 50)
    
    tests = [
        test_navigation_updates,
        test_collections_listing_page,
        test_collection_detail_page,
        test_wishlist_collections_integration,
        test_product_card_integration,
        test_page_routing_structure,
        test_component_exports,
        test_typescript_integration,
        test_responsive_design_patterns,
        test_accessibility_features
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        try:
            if test():
                passed += 1
            print()
        except Exception as e:
            print(f"❌ Test failed with error: {e}")
            print()
    
    print("=" * 50)
    print(f"📊 Phase 4 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All Phase 4 tests passed! Page integration is complete.")
        return True
    else:
        print("❌ Some tests failed. Please review the implementation.")
        return False

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1) 