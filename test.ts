interface Foo {
    mounted?(): void;
}


class MyFoo implements Foo {
    private mounted() {
        return 123;
    }
}
