from setuptools import setup, find_packages

setup(
    name="wemee-environments",
    version="0.1.0",
    description="WeMee Game Environments for Gymnasium",
    author="WeMee",
    packages=find_packages(),
    install_requires=[
        "gymnasium>=0.29.0",
        "numpy>=1.20.0",
    ],
    python_requires=">=3.9",
)
